<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { shortcutKeys, useKeyboardShortcut } from "../button";
import { highlightParts } from "../collection/highlight";
import { SearchInput } from "../controls";
import { Icon } from "../icon";
import { useDialog } from "../overlay";
import { Badge, StatusLine, useWaitStatus } from "../state";
import { useQuickSearch, type QuickSearchAnswer, type QuickSearchGroup, type QuickSearchOptions, type QuickSearchRow } from "./quickSearchControl";

/**
 * The quick-search palette: a dialog with one field and the rows found. Mounted once by the
 * `quickSearch()` feature; use the component directly only to place it yourself (it takes the
 * feature's options as props). Opened by Ctrl or ⌘ + K, the field in the shell's `search` slot or
 * `useQuickSearch().open()`.
 *
 * The shortcut belongs to the page: it does nothing while a dialog is open, as every shortcut of the
 * library. Typing is debounced and an answer that is no longer the latest is dropped; the previous
 * results stay until the new ones arrive. Before anything is typed, the `recent` rows.
 */
const props = withDefaults(defineProps<QuickSearchOptions>(), {
  suggest: undefined,
  recent: undefined,
  onChoose: undefined,
  placeholder: undefined,
  hint: undefined,
  noneHint: undefined,
  minLength: 2,
  delayMs: 180,
});

const { t } = useI18n();
const router = useRouter();
const control = useQuickSearch();

const panel = useTemplateRef<HTMLElement>("panel");
const list = useTemplateRef<HTMLElement>("list");

const { isOpen, present, dismiss } = useDialog(panel, { onDismissed: () => { cancel(); control.close(); } });

useKeyboardShortcut({ key: "k", mod: true, group: "general", label: () => t("core.shell.search.title") }, () => control.open());

// The state belongs to the document: an application taken down while the palette is open must not leave it open.
onScopeDispose(() => control.close());

const query = ref("");
const answer = ref<QuickSearchAnswer | null>(null);
// The query `answer` belongs to: the text may have moved on while the next search waits for its turn.
const answered = ref("");
const loading = ref(false);
const failed = ref(false);
const active = ref(0);
const recent = ref<readonly QuickSearchRow[]>([]);
let running: AbortController | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

const wait = useWaitStatus(loading);
const trimmed = computed(() => query.value.trim());
const searching = computed(() => trimmed.value.length >= props.minLength);

function cancel() {
  clearTimeout(timer);
  running?.abort();
  running = null;
  loading.value = false;
}

watch(control.isOpen, (open) => {
  if (open) {
    query.value = "";
    answer.value = null;
    answered.value = "";
    failed.value = false;
    active.value = 0;
    recent.value = props.recent?.() ?? [];
    present();
  } else if (isOpen.value) {
    cancel();
    void dismiss();
  }
});

watch(trimmed, (value) => {
  cancel();
  active.value = 0;
  if (value.length < props.minLength) {
    answer.value = null;
    answered.value = "";
    failed.value = false;
    return;
  }
  timer = setTimeout(() => void run(value), props.delayMs);
});

async function run(value: string) {
  const mine = new AbortController();
  running = mine;
  loading.value = true;
  failed.value = false;
  try {
    const found = await props.search(value, mine.signal);
    if (!mine.signal.aborted) {
      answer.value = found;
      answered.value = value;
    }
  } catch {
    if (!mine.signal.aborted) failed.value = true;
  } finally {
    if (running === mine) {
      running = null;
      loading.value = false;
    }
  }
}

// The results are those of the query on screen: after the palette reopened or the text changed they wait for the new answer.
const found = computed<readonly QuickSearchGroup[]>(() => (searching.value && answer.value ? answer.value.groups : []));
const suggested = computed<readonly QuickSearchGroup[]>(() => (searching.value ? (props.suggest?.(trimmed.value) ?? []) : []));
const groups = computed<readonly QuickSearchGroup[]>(() => {
  if (!searching.value) return recent.value.length ? [{ key: "recent", label: t("core.shell.search.recent"), rows: recent.value }] : [];
  return [...found.value, ...suggested.value].filter((group) => group.rows.length > 0);
});
const rows = computed(() => groups.value.flatMap((group) => group.rows));
const rowIndex = computed(() => new Map(rows.value.map((row, index) => [row, index])));
const searched = computed(() => searching.value && answered.value === trimmed.value && !loading.value && !failed.value);
// Nothing found is about the results; the suggestions may still follow.
const nothingFound = computed(() => searched.value && !found.value.some((group) => group.rows.length > 0));
const unavailable = computed(() => (searching.value ? (answer.value?.unavailable ?? []) : []));

function move(step: number) {
  if (!rows.value.length) return;
  active.value = (active.value + step + rows.value.length) % rows.value.length;
  void nextTick(() => list.value?.querySelector(`[data-index="${active.value}"]`)?.scrollIntoView({ block: "nearest" }));
}

function choose(row: QuickSearchRow | undefined, newTab = false) {
  if (!row) return;
  props.onChoose?.(row);
  if (newTab) {
    window.open(router.resolve(row.to).href, "_blank", "noopener");
    return;
  }
  void dismiss();
  void router.push(row.to);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    move(event.key === "ArrowDown" ? 1 : -1);
  } else if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    choose(rows.value[active.value], event.metaKey || event.ctrlKey);
  }
}

const TILES = {
  neutral: "bg-surface-inverse text-content-inverse-accent",
  accent: "bg-control-on text-white",
  action: "bg-tint-soft text-content-link",
} as const;

const modKey = computed(() => shortcutKeys({ key: "k", mod: true })[0]);
</script>

<template>
  <Teleport to="body">
    <transition enter-active-class="transition-opacity duration-motion-normal ease-motion-standard" enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-motion-fast ease-motion-standard" leave-to-class="opacity-0">
      <div v-if="isOpen" class="fixed inset-0 z-9999 bg-scrim" aria-hidden="true" @click="dismiss()"></div>
    </transition>
    <transition enter-active-class="transition duration-motion-sheet ease-motion-sheet" enter-from-class="opacity-0 -translate-y-2 scale-98"
      leave-active-class="transition duration-motion-fast ease-motion-standard" leave-to-class="opacity-0 scale-98">
      <div v-if="isOpen" ref="panel" role="dialog" aria-modal="true" :aria-label="t('core.shell.search.title')" tabindex="-1"
        class="fixed inset-x-0 top-0 z-9999 mx-auto flex h-dvh w-full flex-col overflow-hidden bg-surface-overlay text-content-strong shadow-dialog outline-none md:top-[12vh] md:h-auto md:max-h-[72vh] md:max-w-[40rem] md:rounded-dialog"
        data-test="quick-search" @keydown="onKeydown">
        <div class="flex items-center gap-3 border-b border-border-separator px-4 py-3 pt-[max(0.75rem,var(--app-safe-top))] md:px-5 md:py-4">
          <Icon name="search" :size="20" class="shrink-0 text-content-muted" />
          <SearchInput v-model="query" :label="t('core.shell.search.title')" :placeholder="props.placeholder ?? t('core.shell.search.placeholder')" v-bind="{
            role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'quick-search-results',
            'aria-activedescendant': rows.length ? `quick-search-row-${active}` : undefined, 'data-test': 'quick-search-input',
          }" />
          <button type="button" class="hit-target shrink-0 cursor-pointer rounded-control px-1 text-body text-content-link md:hidden" @click="dismiss()">
            {{ t("core.actions.cancel") }}
          </button>
          <kbd class="hidden shrink-0 rounded-md border border-border-separator px-1.5 py-0.5 text-caption text-content-muted md:inline">esc</kbd>
        </div>

        <div id="quick-search-results" ref="list" role="listbox" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 md:px-3"
          data-test="quick-search-results">
          <div v-if="wait.visible.value && !searched" class="px-3 py-3">
            <StatusLine :text="t('core.shell.search.searching')" />
          </div>

          <div v-if="nothingFound" class="flex flex-col items-center gap-1 px-6 py-10 text-center" data-test="quick-search-empty">
            <p class="text-headline font-semibold">{{ t("core.shell.search.none", { query: trimmed }) }}</p>
            <p class="max-w-sm text-subheadline text-content-muted">{{ props.noneHint ?? t("core.shell.search.none_hint") }}</p>
          </div>

          <template v-for="group in groups" :key="group.key">
            <p class="px-3 pt-2.5 pb-1.5 text-footnote font-semibold text-content-muted uppercase" :data-test="`quick-search-group-${group.key}`">{{ group.label }}</p>
            <div v-for="row in group.rows" :id="`quick-search-row-${rowIndex.get(row)}`" :key="row.key" role="option"
              :aria-selected="rowIndex.get(row) === active" :data-index="rowIndex.get(row)" :data-test="`quick-search-row-${row.key}`"
              class="flex cursor-pointer animate-row-in items-center gap-3 rounded-control px-3 py-2.5"
              :class="rowIndex.get(row) === active ? 'bg-surface-selected' : 'hover:bg-fill'"
              @mousemove="active = rowIndex.get(row)!" @click="choose(row, $event.metaKey || $event.ctrlKey)">
              <span class="flex size-8 shrink-0 items-center justify-center rounded-lg" :class="TILES[row.tile ?? 'neutral']">
                <Icon :name="row.icon" :size="16" />
              </span>
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-body font-semibold">
                  <template v-for="(part, index) in highlightParts(row.title, searching ? trimmed : '')" :key="index">
                    <mark v-if="part.match" class="rounded-sm bg-tint-soft px-px text-inherit">{{ part.text }}</mark><template v-else>{{ part.text }}</template>
                  </template>
                </span>
                <span v-if="row.meta" class="truncate text-footnote text-content-muted" :class="row.mono ? 'font-mono tracking-tight' : ''">
                  <template v-for="(part, index) in highlightParts(row.meta, searching ? trimmed : '')" :key="index">
                    <mark v-if="part.match" class="rounded-sm bg-tint-soft px-px text-content-strong">{{ part.text }}</mark><template v-else>{{ part.text }}</template>
                  </template>
                </span>
              </span>
              <Badge v-if="row.badge" :tone="row.badge.tone" class="hidden shrink-0 sm:inline-flex">{{ row.badge.label }}</Badge>
              <Icon v-if="rowIndex.get(row) === active" name="arrowRightSLine" :size="16" class="hidden shrink-0 text-content-muted md:inline" />
            </div>
          </template>

          <p v-if="failed" class="px-3 py-3 text-subheadline text-content-destructive" role="alert">{{ t("core.shell.search.failed") }}</p>
          <p v-if="unavailable.length" class="px-3 py-2 text-footnote text-content-muted" data-test="quick-search-unavailable">
            {{ t("core.shell.search.unavailable", { groups: unavailable.join(", ") }) }}
          </p>
          <p v-if="!groups.length && !searching" class="px-3 py-8 text-center text-subheadline text-content-muted">{{ props.hint ?? t("core.shell.search.hint") }}</p>
        </div>

        <div class="hidden items-center gap-4 border-t border-border-separator px-5 py-2.5 text-footnote text-content-muted md:flex">
          <span><kbd class="font-semibold">↑ ↓</kbd> {{ t("core.shell.search.select") }}</span>
          <span><kbd class="font-semibold">↵</kbd> {{ t("core.shell.search.open_row") }}</span>
          <span><kbd class="font-semibold">{{ modKey }} ↵</kbd> {{ t("core.shell.search.new_tab") }}</span>
        </div>
      </div>
    </transition>
  </Teleport>
</template>
