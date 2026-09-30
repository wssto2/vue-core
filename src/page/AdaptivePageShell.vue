<script setup lang="ts">
import { computed, onBeforeUnmount, provide, ref, useTemplateRef, watch } from "vue";
import { useMediaQuery } from "../internal/mediaQuery";
import BottomDockPortal from "./BottomDockPortal.vue";
import PageActions from "./PageActions.vue";
import PageToolbar from "./PageToolbar.vue";
import ResourceHeader from "./ResourceHeader.vue";
import { createPageChrome, pageChromeKey, useOptionalPageChrome } from "./chrome";
import { pageSectionBackKey } from "./sectionBack";
import { usePageFocus } from "./usePageFocus";
import type { IconName } from "../icon";
import type { PageAction, PageBack, PagePathItem, PageSectionBack } from "./types";

/**
 * The page chrome: one shell for every page, so the repeated parts are written once.
 *
 * - Desktop, record pages (with `back`): a sticky toolbar with "‹ List" back (the list's state is
 *   in its route), the record pager, a status and the page actions.
 * - Desktop, collection and settings pages (no back): the actions sit in the large-title header
 *   row; no toolbar.
 * - Phones: the app's header becomes the nav bar with the same back, title and actions (it reads
 *   them from the page chrome); the pager floats under the content.
 *
 * Actions come from the `actions` prop and from `usePageChrome()` calls in the page's routed
 * sections (the Edit and Save of a section). The shell owns the page gutters and content width, and
 * the app drops its own padding while one is mounted.
 *
 *   <AdaptivePageShell :title="name" :back="{ label: t('customers'), to: listRoute }" width="content">
 *     <template #pager><RecordPager … /></template>
 *     <template #header><RecordHeader :title="name" … /></template>
 *     <RouterView />
 *   </AdaptivePageShell>
 *
 * It restores the focused link and scroll position when the user comes back to the same URL. The
 * page chrome is the app's (`installPageChrome`); without one, the shell keeps its own for the
 * sections inside it.
 */
const props = withDefaults(defineProps<{
  title: string;
  /**
   * The browser tab title when the page's title is data (a record's name) and its route's `titleKey`
   * cannot say it; the app's tab title format still applies. By default the route's own.
   */
  documentTitle?: string | null;
  description?: string;
  icon?: IconName;
  count?: number | null;
  actions?: readonly PageAction[];
  /** Back to the parent (a list with its state). Defaults to the last `path` item. */
  back?: PageBack | null;
  /**
   * The ancestors of a page deep in a hierarchy, ending with its parent: two or more render as a
   * clickable path in the desktop toolbar; phones show the back alone.
   */
  path?: readonly PagePathItem[] | null;
  width?: "full" | "content" | "readable";
}>(), {
  documentTitle: undefined,
  description: undefined,
  icon: undefined,
  count: undefined,
  actions: () => [],
  back: undefined,
  path: undefined,
  width: "full",
});

defineSlots<{
  default?: () => unknown;
  /** Replaces the large-title header (a `RecordHeader`). */
  header?: () => unknown;
  /** The record pager: in the toolbar on desktop, floating under the content on phones. */
  pager?: () => unknown;
  notices?: () => unknown;
  /** A bar in the app's bottom dock. */
  bottom?: () => unknown;
}>();

// The app's chrome, or the shell's own for what renders inside it.
const chrome = useOptionalPageChrome() ?? createPageChrome();
provide(pageChromeKey, chrome);
const releaseShell = chrome.claimShell();
onBeforeUnmount(releaseShell);

const root = useTemplateRef<HTMLElement>("root");
usePageFocus(root, chrome);

const phone = useMediaQuery("(max-width: 47.999rem)");

// A nested section on a compact screen goes back to the record's first section; a page inside a
// section extends the page's own path on desktop.
const sectionBack = ref<PageSectionBack | null>(null);
provide(pageSectionBackKey, sectionBack);

const back = computed<PageBack | null>(() => {
  if (sectionBack.value) return sectionBack.value;
  if (props.back !== undefined) return props.back;
  const parent = props.path?.[props.path.length - 1];
  return parent ? { label: parent.label, to: parent.to } : null;
});

const toolbarPath = computed<readonly PagePathItem[] | null | undefined>(() => {
  const section = sectionBack.value;
  if (!section) return props.path;
  if (!section.path) return null;
  const own = props.path ?? (props.back ? [props.back] : []);
  return [...own, ...section.path];
});

// The shell's own chrome: its `actions` prop and its back. (Registered through the owner directly:
// a component cannot inject what it provides itself.)
const owner = chrome.claim();
watch(
  () => [props.actions, props.documentTitle] as const,
  ([actions, documentTitle]) => owner.setRegistration({ actions, leading: null, status: null, navTitle: null, documentTitle: documentTitle ?? null }),
  { immediate: true },
);
watch(back, (value) => owner.setBack(value), { immediate: true });
onBeforeUnmount(() => {
  owner.clearRegistration();
  owner.clearBack();
});

const WIDTHS = { full: "", content: "max-w-content", readable: "max-w-readable" } as const;
</script>

<template>
  <div ref="root" class="min-w-0 w-full flex-1 bg-surface-page" data-page-shell>
    <PageToolbar v-if="back && !phone" :back="back" :path="toolbarPath" :actions="chrome.actions.value" :leading="chrome.leading.value"
      :status="chrome.status.value">
      <template v-if="$slots.pager" #pager><slot name="pager" /></template>
    </PageToolbar>

    <!-- Page gutters from the geometry tokens, with safe-area insets; the bottom clears the dock.
         The toolbar above stays full-bleed. -->
    <div class="mx-auto flex min-w-0 flex-col gap-section-gap pt-section-gap pr-[max(var(--app-screen-padding),var(--app-safe-right))] pb-[max(var(--app-screen-padding),var(--app-safe-bottom),calc(var(--bottom-dock-h,0px)+var(--app-screen-padding)))] pl-[max(var(--app-screen-padding),var(--app-safe-left))] lg:pt-[calc(var(--app-section-gap)*1.5)] lg:pr-[max(2.5rem,var(--app-safe-right))] lg:pl-[max(2.5rem,var(--app-safe-left))]"
      :class="WIDTHS[props.width]">
      <slot name="header">
        <ResourceHeader :title="props.title" :description="props.description" :icon="props.icon" :count="props.count"
          :actions="back ? [] : chrome.actions.value" :leading="back ? null : chrome.leading.value" :status="back ? null : chrome.status.value" />
      </slot>
      <!-- A record page without a toolbar (no back): its actions follow the header. -->
      <PageActions v-if="$slots.header && !back && !phone" :actions="chrome.actions.value" :leading="chrome.leading.value" />
      <div v-if="$slots.notices"><slot name="notices" /></div>
      <slot />
      <div v-if="$slots.pager && phone" class="flex justify-center pt-2"><slot name="pager" /></div>
    </div>

    <BottomDockPortal v-if="$slots.bottom">
      <div class="dock-safe-area pointer-events-auto order-1 border-t border-border-separator bg-surface-cell pt-screen-padding pr-[max(var(--app-screen-padding),var(--app-safe-right))] pb-screen-padding pl-[max(var(--app-screen-padding),var(--app-safe-left))]">
        <slot name="bottom" />
      </div>
    </BottomDockPortal>
  </div>
</template>
