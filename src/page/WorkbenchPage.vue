<script setup lang="ts">
import { computed, onBeforeUnmount, provide, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useLeaveGuard } from "../form/leaveGuard";
import { useMediaQuery } from "../internal/mediaQuery";
import PageActions from "./PageActions.vue";
import PageToolbar from "./PageToolbar.vue";
import SplitPane from "./SplitPane.vue";
import { useOriginBack } from "./back";
import { createPageChrome, pageChromeKey, useOptionalPageChrome } from "./chrome";
import { pageSectionBackKey } from "./sectionBack";
import type { PageAction, PageBack, PagePathItem, PageSectionBack } from "./types";

/**
 * A page for work that needs the whole screen: a code editor with its preview, a page with its settings. It fills the viewport under the
 * shell (no page scroll, no maximum width): a header, an optional row of tabs, and a body of two panes with a draggable divider
 * (`SplitPane`), each pane scrolling on its own. Below `lg` the panes stack and the page scrolls as any page.
 *
 * The header is the one of `EditorPage` and `AdaptivePageShell`: "‹ Back" to the parent list (or the clickable `path` when the page is
 * deep; `?back=` still wins), the title with `#badges` and a `description` line, the `actions` and a "More" menu for the overflow ones.
 * Actions registered by `usePageChrome()` / `useSaveChrome()` inside the page join them, and phones show them in the app's nav bar.
 * `dirty` is the unsaved-changes guard: "Unsaved changes" beside the actions, and a question before leaving (a route change, closing
 * the tab). Without `#end` the `#start` pane takes the whole body.
 *
 *   <WorkbenchPage :title="template.name" :back="{ label: t('templates'), to: templatesRoute }" :actions="actions" :dirty="form.dirty.value" storage-key="template-editor">
 *     <template #badges><Badge tone="warning">Draft v4</Badge></template>
 *     <template #start><CodeEditor fill v-model="source" language="liquid" /></template>
 *     <template #end><PreviewFrame :src="previewUrl" title="Preview" /></template>
 *   </WorkbenchPage>
 */
const props = withDefaults(defineProps<{
  title: string;
  /** The browser tab title when the title is data; by default the route's own. */
  documentTitle?: string | null;
  /** The line under the title ("Template · saved today 09:41"). */
  description?: string;
  back?: PageBack | null;
  path?: readonly PagePathItem[] | null;
  actions?: readonly PageAction[];
  /** Unsaved changes: the status beside the actions, and the leave guard. */
  dirty?: boolean;
  /** Remembers the divider in this browser (see `SplitPane`). */
  storageKey?: string;
  /** Smallest pane, in pixels. */
  min?: number;
  stackBelow?: "md" | "lg" | "xl";
}>(), { documentTitle: undefined, description: undefined, back: undefined, path: undefined, actions: () => [], dirty: false, storageKey: undefined, min: 280, stackBelow: "lg" });

/** The share (0 to 1) of the start pane. */
const size = defineModel<number>("size", { default: 0.5 });

defineSlots<{
  /** Beside the title: status badges ("Draft v4", "Published v3"). */
  badges?: () => unknown;
  /** Before the title: a tile with the page's icon. */
  leading?: () => unknown;
  /** A row between the header and the panes (section tabs). */
  subheader?: () => unknown;
  notices?: () => unknown;
  start?: () => unknown;
  end?: () => unknown;
}>();

const { t } = useI18n();

// The app's chrome, or the page's own for what renders inside it (the same arrangement as AdaptivePageShell).
const chrome = useOptionalPageChrome() ?? createPageChrome();
provide(pageChromeKey, chrome);
const releaseShell = chrome.claimShell();
onBeforeUnmount(releaseShell);

const phone = useMediaQuery("(max-width: 47.999rem)");
const sectionBack = ref<PageSectionBack | null>(null);
provide(pageSectionBackKey, sectionBack);
const originBack = useOriginBack();
const back = computed<PageBack | null>(() => {
  if (originBack.value) return originBack.value;
  if (props.back !== undefined) return props.back;
  const parent = props.path?.[props.path.length - 1];
  return parent ? { label: parent.label, to: parent.to } : null;
});
const toolbarPath = computed(() => (originBack.value ? null : props.path));

const owner = chrome.claim();
watch(
  () => [props.actions, props.documentTitle, props.dirty] as const,
  ([actions, documentTitle, dirty]) => owner.setRegistration({ actions, leading: null, status: dirty ? t("core.form.unsaved_changes") : null, navTitle: null, documentTitle: documentTitle ?? null }),
  { immediate: true },
);
watch(back, (value) => owner.setBack(value), { immediate: true });
onBeforeUnmount(() => {
  owner.clearRegistration();
  owner.clearBack();
});

useLeaveGuard(() => props.dirty);
</script>

<template>
  <div class="flex min-h-0 w-full min-w-0 flex-1 flex-col bg-surface-page lg:h-[calc(100dvh-var(--shell-banner-h,0px))] lg:flex-none lg:overflow-hidden" data-page-shell data-workbench-page>
    <PageToolbar v-if="back && !phone" :back="back" :path="toolbarPath" :actions="[]" :leading="null" />

    <header class="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-separator bg-surface-cell px-4 py-3 lg:px-6">
      <div class="flex min-w-0 flex-[1_1_16rem] items-center gap-3.5">
        <slot name="leading" />
        <div class="flex min-w-0 flex-col gap-0.5">
          <div class="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 class="min-w-0 truncate text-title font-semibold tracking-tight text-content-strong">{{ props.title }}</h1>
            <slot name="badges" />
          </div>
          <p v-if="props.description" class="truncate text-subheadline text-content-muted">{{ props.description }}</p>
        </div>
      </div>
      <div v-if="!phone" class="ml-auto flex items-center gap-3">
        <span v-if="chrome.status.value" class="flex shrink-0 items-center gap-1.5 text-footnote text-content-muted" role="status" data-page-status>
          <span class="size-1.75 rounded-full bg-tint" aria-hidden="true"></span>{{ chrome.status.value }}
        </span>
        <PageActions :actions="chrome.actions.value" :leading="chrome.leading.value" />
      </div>
    </header>

    <div v-if="$slots.subheader" class="shrink-0 border-b border-border-separator bg-surface-page px-4 py-2 lg:px-6"><slot name="subheader" /></div>
    <div v-if="$slots.notices" class="shrink-0"><slot name="notices" /></div>

    <div class="min-h-0 flex-1 bg-surface-cell" data-workbench-body>
      <SplitPane v-if="$slots.end" v-model:size="size" :storage-key="props.storageKey" :min="props.min" :stack-below="props.stackBelow">
        <template #start><slot name="start" /></template>
        <template #end><slot name="end" /></template>
      </SplitPane>
      <div v-else class="h-full min-h-0 overflow-hidden"><slot name="start" /></div>
    </div>
  </div>
</template>
