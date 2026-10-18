<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Icon, type IconName } from "../icon";
import { usePreferences } from "../identity/usePreferences";
import { arrowSide, useAnchoredPosition } from "../overlay/anchored";
import { idsPatch, storedIds } from "./tips";

/**
 * A tip beside something new: a card with an icon, a title and a sentence, pointing at the first visible element `anchor`
 * selects (or at the element it is given), which glows while the tip is open. It is shown until the person closes it, with
 * the button or Escape, and then never again: the id goes into the person's stored preferences (`usePreferences`),
 * a list of ids at `dismissedAt`. A refused save brings the tip back with a toast. Nothing shows without the element: the
 * anchor may render after the tip, so it is looked for a little while. One tip is open at a time, app-wide; the others wait.
 *
 *   <Tip id="search" anchor="[data-test=search]" title="Quick search" text="Press Ctrl + K to find anything." />
 *
 * What comes before it is the app's (a welcome, a release note): `ready` holds the tip back until then.
 */
const props = withDefaults(defineProps<{
  /** Which tip this is; what is stored once it is closed. */
  id: string;
  /** A CSS selector (the first visible match) or the element itself. */
  anchor: string | Element | null;
  title: string;
  /** The sentence under the title; or the default slot. */
  text?: string;
  /** False holds the tip back (something else comes first). */
  ready?: boolean;
  /** Where in the preferences the closed ids are kept, as a path of keys. */
  dismissedAt?: readonly string[];
  icon?: IconName;
}>(), { text: undefined, ready: true, dismissedAt: () => ["tips_dismissed"], icon: "informationLine" });

const { t } = useI18n();
const preferences = usePreferences<Record<string, unknown>>();

const panel = ref<HTMLElement | null>(null);
const ok = ref<HTMLButtonElement | null>(null);
const arrowEl = ref<HTMLElement | null>(null);
const target = ref<Element | null>(null);
let findTimer: ReturnType<typeof setInterval> | null = null;

const dismissed = computed(() => storedIds(preferences.value.value, props.dismissedAt));
const wanted = computed(() => props.ready && !dismissed.value.includes(props.id));
const open = computed(() => wanted.value && target.value !== null && active.value === props.id);

const visible = (element: Element) => element instanceof HTMLElement && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
const locate = (): Element | null => (typeof props.anchor === "string" ? [...document.querySelectorAll(props.anchor)].find(visible) ?? null : props.anchor);

const FIND_EVERY_MS = 150;
const FIND_FOR_MS = 6000;

function find() {
  stopFinding();
  const found = locate();
  if (found) return settleOn(found);
  let tries = 0;
  findTimer = setInterval(() => {
    const element = locate();
    if (element || ++tries * FIND_EVERY_MS > FIND_FOR_MS) {
      stopFinding();
      settleOn(element);
    }
  }, FIND_EVERY_MS);
}
function settleOn(element: Element | null) {
  target.value = element;
  claim();
}
function stopFinding() {
  if (findTimer) clearInterval(findTimer);
  findTimer = null;
}

/** Takes the one open slot when it is free: the first waiting tip shows, the rest queue. */
function claim() {
  if (wanted.value && target.value && active.value === null) active.value = props.id;
}
function release() {
  if (active.value === props.id) active.value = null;
}

watch([wanted, () => props.anchor], ([isWanted]) => (isWanted ? find() : (stopFinding(), release())), { immediate: true });
watch(active, (current) => current === null && claim());

const { style, arrowStyle, resolvedPlacement } = useAnchoredPosition(panel, {
  reference: () => target.value,
  placement: () => "bottom-start",
  offset: 12,
  padding: 12,
  arrow: arrowEl,
});

// The anchor glows while the tip is open (styled by the library's stylesheet).
watch(open, (isOpen, _was, onCleanup) => {
  const element = target.value;
  if (!isOpen || !element) return;
  element.setAttribute("data-tip-anchor", "");
  onCleanup(() => element.removeAttribute("data-tip-anchor"));
}, { immediate: true });

// A tip that appears on its own must not take the focus from what the person is doing, but it is reachable when nothing has it.
watch(panel, (element) => {
  if (element && (document.activeElement === null || document.activeElement === document.body)) void nextTick(() => ok.value?.focus({ preventScroll: true }));
});

function dismiss() {
  const hadFocus = panel.value?.contains(document.activeElement) === true;
  // Applied at once (the tip goes), taken back with a toast when the server refuses.
  void preferences.save(idsPatch(props.dismissedAt, [...new Set([...dismissed.value, props.id])]));
  if (hadFocus && target.value instanceof HTMLElement) target.value.focus({ preventScroll: true });
}

onBeforeUnmount(() => {
  stopFinding();
  release();
});
</script>

<script lang="ts">
import { ref as sharedRef } from "vue";

/** The id of the tip that is open: one at a time, app-wide. */
const active = sharedRef<string | null>(null);
</script>

<template>
  <Teleport to="body">
    <Transition enter-active-class="transition-opacity duration-motion-fast ease-motion-standard" enter-from-class="opacity-0"
      leave-active-class="pointer-events-none transition-opacity duration-motion-fast ease-motion-standard" leave-to-class="opacity-0">
      <div v-if="open" ref="panel" role="dialog" tabindex="-1" :aria-label="props.title" :data-test="`tip-${props.id}`" :style="style"
        class="z-1000 flex w-80 max-w-[calc(100vw-1.5rem)] gap-3 rounded-2xl bg-surface-cell p-4 text-content-strong shadow-dialog ring-1 ring-border-separator outline-none"
        @keydown.esc.stop.prevent="dismiss">
        <span ref="arrowEl" aria-hidden="true" class="absolute size-3 rotate-45 bg-surface-cell" :class="{
          '-bottom-1.5': arrowSide(resolvedPlacement) === 'bottom',
          '-top-1.5': arrowSide(resolvedPlacement) === 'top',
          '-left-1.5': arrowSide(resolvedPlacement) === 'left',
          '-right-1.5': arrowSide(resolvedPlacement) === 'right',
        }" :style="arrowStyle" />
        <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-tint-soft text-content-link"><Icon :name="props.icon" :size="16" /></span>
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="text-subheadline font-semibold">{{ props.title }}</span>
          <span class="text-footnote text-content-muted"><slot>{{ props.text }}</slot></span>
          <button ref="ok" type="button" class="mt-1 self-start text-subheadline font-semibold text-content-link hover:underline" :data-test="`tip-ok-${props.id}`" @click="dismiss">
            {{ t("core.tip.ok") }}
          </button>
        </div>
        <button type="button" class="hit-target -mt-1 -mr-1 grid size-6 shrink-0 place-items-center rounded-full bg-fill text-content-muted hover:bg-fill-strong" :aria-label="t('core.actions.close')" @click="dismiss">
          <Icon name="close" :size="12" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
