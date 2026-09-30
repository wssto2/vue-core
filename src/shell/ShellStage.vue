<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, provide, ref, useId, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter, type RouteLocationRaw } from "vue-router";
import { useMediaQuery } from "../internal/mediaQuery";
import { useDialog } from "../overlay/useDialog";
import { useDrawerDrag } from "./drawerDrag";
import { navigationDrawerKey } from "./drawer";

/**
 * The app stage and the phone navigation drawer behind it (UI decision D18). The stage (the
 * default slot: top bar, page, bottom dock) slides right by the drawer's width with rounded
 * corners, a shadow and a light dim, like the Claude iPhone app; the drawer's content is the
 * `#drawer` slot.
 *
 * A transform turns every `position: fixed` descendant (the bottom dock) and `sticky` bar into
 * stage-relative boxes, so while the drawer is open or dragged the stage is *detached*: fixed to
 * the viewport, clipped, and scrolled internally to where the window was, so the dock stays on the
 * stage's bottom edge and slides with the page and sticky bars stay put. The scroll lives on an
 * inner layer, not the stage: fixed descendants are laid out against the transformed stage and
 * would move with the content if the stage itself were the scroll container. Closing re-attaches
 * it and restores the window scroll (the top, when a destination was chosen).
 *
 * Only below md and `enabled`; otherwise the slot renders as it is. The drawer is a modal dialog on
 * the dialog stack (Escape, a Tab trap, focus back to the menu button); the pushed page is inert
 * and a tap on it closes. It opens from a menu button (`useNavigationDrawer()`), or from the left
 * edge in the installed app. Reduced motion: the page does not slide, the drawer fades.
 *
 *   <ShellStage :enabled="signedIn">
 *     <template #drawer="{ select }"><NavigationDrawer :identity="identity" @select="select" /></template>
 *     …top bar, page, dock…
 *   </ShellStage>
 */
const props = defineProps<{ enabled: boolean }>();

defineSlots<{
  default?: () => unknown;
  /** The drawer's content. `select` navigates and closes; `dismiss(then)` closes, then runs `then`. */
  drawer?: (scope: { select: (to: RouteLocationRaw) => void; dismiss: (then?: () => void) => void }) => unknown;
}>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const isPhone = useMediaQuery("(max-width: 47.999rem)");
const isStandalone = useMediaQuery("(display-mode: standalone)");
const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
const active = computed(() => props.enabled && isPhone.value);

const stage = useTemplateRef<HTMLElement>("stage");
const scroller = useTemplateRef<HTMLElement>("scroller");
const panel = ref<HTMLElement | null>(null);
const panelId = useId();

/** The drawer was asked to be open. */
const requested = ref(false);
/** The stage is fixed to the viewport (open, opening, closing or dragged). */
const detached = ref(false);
/** Where the stage rests: the drawer's width while open, 0 while closed. */
const settledOpen = ref(false);
let savedScroll = 0;
let routeChanged = false;
let attachTimer: ReturnType<typeof setTimeout> | undefined;
let afterClose: (() => void) | null = null;

const width = () => panel.value?.offsetWidth ?? 0;

const drag = useDrawerDrag({
  enabled: () => active.value,
  width,
  isOpen: () => settledOpen.value,
  canOpenFromEdge: () => isStandalone.value || (navigator as Navigator & { standalone?: boolean }).standalone === true,
  onStart: () => {
    clearTimeout(attachTimer);
    detach();
  },
  onSettle: (open) => (open ? (requested.value = true) : closeDrawer()),
});

const offset = computed(() => (drag.dragging.value ? drag.offset.value : settledOpen.value ? width() : 0));
const progress = computed(() => (width() ? offset.value / width() : 0));

const dialog = useDialog(panel, {
  initialFocus: "panel",
  onEscape: () => closeDrawer(),
});

function motionMs() {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--app-motion-drawer").trim();
  return value.endsWith("ms") ? parseFloat(value) : parseFloat(value) * 1000 || 0;
}

function detach() {
  const element = stage.value;
  const inner = scroller.value;
  if (detached.value || !element || !inner) return;

  savedScroll = window.scrollY;
  routeChanged = false;
  // Directly, in this order, so no frame shows the stage at the top of the page.
  Object.assign(element.style, { position: "fixed", inset: "0", overflow: "hidden", zIndex: "10" });
  Object.assign(inner.style, { position: "absolute", inset: "0", overflow: "hidden" });
  inner.scrollTop = savedScroll;
  detached.value = true;
}

function attach() {
  const element = stage.value;
  const inner = scroller.value;
  if (!detached.value || !element || !inner) return;

  Object.assign(element.style, { position: "", inset: "", overflow: "", zIndex: "", transform: "", transition: "", borderRadius: "" });
  Object.assign(inner.style, { position: "", inset: "", overflow: "" });
  detached.value = false;
  window.scrollTo({ top: routeChanged ? 0 : savedScroll, behavior: "instant" });
}

// The stage's transform is written directly too: it must never be patched by a render that races the detach above.
watch([offset, () => drag.dragging.value, detached], () => {
  const element = stage.value;
  if (!element || !detached.value) return;

  element.style.transform = `translate3d(${offset.value}px, 0, 0)`;
  element.style.borderRadius = offset.value > 0 ? "2.5rem" : "";
  element.style.transition = drag.dragging.value || reducedMotion.value
    ? "none"
    : "transform var(--app-motion-drawer) var(--app-motion-sheet-easing), border-radius var(--app-motion-drawer) var(--app-motion-sheet-easing)";
}, { flush: "sync" });

function openDrawer() {
  if (!active.value) {
    requested.value = false;
    return;
  }
  clearTimeout(attachTimer);
  afterClose = null;
  detach();
  // Lay the stage out at its current offset first, so the slide animates.
  void stage.value?.offsetWidth;
  settledOpen.value = true;
  dialog.present();
  void nextTick(() => {
    // After the dialog's own initial focus: the current destination, else the panel.
    panel.value?.querySelector<HTMLElement>('[aria-current="page"]')?.focus({ preventScroll: true });
  });
}

/** Closes (animated), then runs `then` once the page is back in place. */
function closeDrawer(then?: () => void) {
  if (then) afterClose = then;
  if (requested.value) {
    requested.value = false; // the watcher below closes
    return;
  }
  settledOpen.value = false;
  dialog.dismissWithoutAsking();
  clearTimeout(attachTimer);
  attachTimer = setTimeout(finishClose, motionMs() + 30);
}

function finishClose() {
  attach();
  const next = afterClose;
  afterClose = null;
  next?.();
}

watch(requested, (open) => (open ? openDrawer() : closeDrawer()));

// Past md (rotation, a resized window) or signed out: gone at once.
watch(active, (on) => {
  if (on) return;
  drag.cancel();
  clearTimeout(attachTimer);
  afterClose = null;
  requested.value = false;
  settledOpen.value = false;
  dialog.dismissWithoutAsking();
  attach();
});

// Any navigation (a destination, a notification's link, the browser) closes it.
watch(() => route.fullPath, () => {
  if (detached.value) routeChanged = true;
  if (settledOpen.value) closeDrawer();
});

function select(to: RouteLocationRaw) {
  // A leave guard may keep the page ("stay"); the drawer closes either way.
  router.push(to).catch(() => undefined).finally(() => closeDrawer());
}

provide(navigationDrawerKey, {
  available: active,
  open: requested,
  panelId,
  present: () => {
    if (active.value) requested.value = true;
  },
  dismiss: closeDrawer,
});

onBeforeUnmount(() => {
  clearTimeout(attachTimer);
  attach();
});
</script>

<template>
  <div v-if="active" :id="panelId" ref="panel" role="dialog" aria-modal="true" :aria-label="t('core.shell.menu')" tabindex="-1"
    data-shell-drawer class="fixed inset-y-0 left-0 z-0 w-[min(82vw,20rem)] outline-none" :class="detached ? 'visible' : 'invisible'"
    :style="reducedMotion ? { opacity: settledOpen || drag.dragging.value ? 1 : 0, transition: 'opacity var(--app-motion-drawer) linear' } : undefined"
    v-bind="drag.closeEvents">
    <slot name="drawer" :select="select" :dismiss="closeDrawer" />
  </div>

  <div ref="stage" data-shell-stage :data-drawer="settledOpen ? 'open' : undefined" class="flex flex-1 flex-col"
    :class="detached ? 'overscroll-none bg-surface-page shadow-dialog' : ''" :inert="settledOpen || drag.dragging.value || undefined">
    <div ref="scroller" class="flex flex-1 flex-col">
      <slot />
    </div>
    <!-- The light dim over the pushed page (a fixed box inside the transformed stage covers the stage). -->
    <div v-if="detached" aria-hidden="true" class="pointer-events-none fixed inset-0 z-50 bg-scrim" :style="{ opacity: progress * 0.55 }"></div>
  </div>

  <!-- The pushed page cannot take events (inert); this layer over it closes on a tap or a drag. -->
  <div v-if="detached && offset > 0" aria-hidden="true" data-shell-stage-cover class="fixed inset-y-0 right-0 z-20" :style="{ left: `${offset}px` }"
    v-bind="drag.closeEvents" @click="closeDrawer()"></div>
</template>
