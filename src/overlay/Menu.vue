<script lang="ts">
import type { IconName } from "../icon";
import type { Tone } from "../state";

/** One command of a `Menu`. */
export interface MenuItem {
  id: string;
  label: string;
  icon?: IconName;
  /** A status dot before the label (an option that is a state). */
  dot?: Tone;
  /** Items with a different section start a new block after a separator. */
  section?: string;
  /** `critical` commands go last, in their own block, in red. */
  tone?: "critical";
  disabled?: boolean;
  processing?: boolean;
  /** Shown on the right on wide screens (display only). */
  shortcut?: string;
  /**
   * A choice among the items (the current location): the item is a `menuitemradio` with
   * `aria-checked`, and the current one (`true`) also draws a tick at the trailing end, as the
   * account menu does, so the tick is never the only way it is told. `false` reserves nothing.
   */
  checked?: boolean;
  onSelect: () => void;
}
</script>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, useId, watch } from "vue";
import type { Placement } from "@floating-ui/dom";
import { Icon } from "../icon";
import ToneDot from "../state/ToneDot.vue";
import { useAnchoredPosition } from "./anchored";
import { INERT_SKIP_ATTR } from "./dialogStack";
import { CLOSE_OVERLAYS_EVENT } from "./closeOverlays";

/**
 * A list of commands anchored to the control that opened it: the toolbar overflow on desktop, the
 * "More" button of the phone nav bar. Sections split by `section`, critical commands last and red,
 * shortcuts on the right on wide screens.
 *
 *   <Menu :items="items" :label="t('moreActions')">
 *     <template #trigger="{ toggle, attrs }"><button v-bind="attrs" @click="toggle">…</button></template>
 *   </Menu>
 *
 * Keyboard: ↑/↓/Home/End move, Enter/Space choose, Escape closes and returns focus to the trigger,
 * Tab leaves (and closes). Choosing restores focus to the trigger before running the command, so a
 * dialog it opens records the right opener. The panel is teleported to `<body>` (a blurred bar is a
 * containing block for fixed children) and opts out of dialog inertness.
 *
 * Without a `trigger` slot it is a context menu: `presentAt(x, y)` opens it at the pointer (a list
 * row's long press or right click) and returns focus to what had it.
 */
const props = withDefaults(defineProps<{
  items: readonly MenuItem[];
  /** The accessible name of the menu. */
  label: string;
  placement?: Placement;
}>(), { placement: "bottom-end" });

const emit = defineEmits<{ presented: []; dismissed: [] }>();

defineSlots<{
  trigger?: (scope: {
    presented: boolean;
    toggle: () => void;
    attrs: { "aria-haspopup": "menu"; "aria-expanded": boolean; "aria-controls": string; "data-menu-trigger": string };
  }) => unknown;
}>();

const GUTTER = 8;

const menuId = `menu-${useId()}`;
const isOpen = ref(false);
const anchor = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);

type Row = { kind: "item"; item: MenuItem } | { kind: "separator"; key: string };

// Critical commands go last, in their own block.
const ordered = computed(() => [...props.items.filter((item) => !item.tone), ...props.items.filter((item) => item.tone)]);

const rows = computed<Row[]>(() => {
  const result: Row[] = [];
  let previous: MenuItem | null = null;
  for (const item of ordered.value) {
    if (previous && (previous.section !== item.section || (item.tone && !previous.tone))) result.push({ kind: "separator", key: `sep-${item.id}` });
    result.push({ kind: "item", item });
    previous = item;
  }
  return result;
});

const trigger = () =>
  anchor.value?.querySelector<HTMLElement>("[data-menu-trigger]") ?? (anchor.value?.firstElementChild as HTMLElement | null) ?? null;

// A context menu opens at the pointer: a zero-size virtual reference there, and focus goes back
// to whatever had it (the row's link) when it closes.
const point = ref<{ x: number; y: number } | null>(null);
let returnFocus: HTMLElement | null = null;

const { style, update } = useAnchoredPosition(panel, {
  // The point is read now, not when floating-ui measures: the menu may have closed (and cleared it) by then.
  reference: () => {
    const at = point.value;
    return at ? { getBoundingClientRect: () => DOMRect.fromRect({ x: at.x, y: at.y, width: 0, height: 0 }) } : trigger();
  },
  placement: () => (point.value ? "bottom-start" : props.placement),
  offset: 6,
  padding: GUTTER,
  fit: (floating, available) => {
    floating.style.maxHeight = `${Math.max(120, available.height)}px`;
  },
});

const enabledButtons = () =>
  Array.from(panel.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled]), [role="menuitemradio"]:not([disabled])') ?? []);

function focusAt(index: number) {
  const buttons = enabledButtons();
  if (buttons.length === 0) return;
  buttons[(index + buttons.length) % buttons.length]?.focus();
}

function present() {
  if (isOpen.value || props.items.length === 0) return;
  point.value = null;
  isOpen.value = true;
  emit("presented");
}

/** Opens as a context menu at viewport coordinates. */
function presentAt(x: number, y: number) {
  if (props.items.length === 0) return;
  returnFocus = document.activeElement as HTMLElement | null;
  point.value = { x, y };
  if (isOpen.value) void nextTick(update);
  else {
    isOpen.value = true;
    emit("presented");
  }
}

function dismiss(restore = true) {
  if (!isOpen.value) return;
  isOpen.value = false;
  emit("dismissed");
  const target = point.value ? returnFocus : trigger();
  point.value = null;
  returnFocus = null;
  if (restore) void nextTick(() => target?.focus?.({ preventScroll: true }));
}

function toggle() {
  if (isOpen.value) dismiss();
  else present();
}

async function choose(item: MenuItem) {
  if (item.disabled || item.processing) return;
  dismiss();
  await nextTick();
  item.onSelect();
}

function onPanelKeydown(event: KeyboardEvent) {
  const current = enabledButtons().indexOf(document.activeElement as HTMLButtonElement);
  switch (event.key) {
    case "ArrowDown": event.preventDefault(); focusAt(current + 1); break;
    case "ArrowUp": event.preventDefault(); focusAt(current - 1); break;
    case "Home": event.preventDefault(); focusAt(0); break;
    case "End": event.preventDefault(); focusAt(-1); break;
    case "Tab": dismiss(false); break;
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  // Capture phase: close the menu only, not an enclosing dialog.
  event.preventDefault();
  event.stopPropagation();
  dismiss();
}

function onPointerDown(event: PointerEvent) {
  const target = event.target as Node | null;
  if (target && (panel.value?.contains(target) || anchor.value?.contains(target))) return;
  // The press that opened a context menu (a long press) is not an outside press.
  if (point.value && event.pointerType === "touch" && !panel.value) return;
  dismiss(false);
}

watch(panel, (element) => {
  if (element) void nextTick(() => focusAt(0));
});

function onCloseOverlays() {
  dismiss();
}

function removeListeners() {
  window.removeEventListener("keydown", onKeydown, true);
  document.removeEventListener("pointerdown", onPointerDown, true);
  document.removeEventListener(CLOSE_OVERLAYS_EVENT, onCloseOverlays);
}

watch(isOpen, (open) => {
  if (open) {
    window.addEventListener("keydown", onKeydown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener(CLOSE_OVERLAYS_EVENT, onCloseOverlays);
  } else removeListeners();
});

// A permission or viewport change must not leave an obsolete menu open.
watch(() => props.items.length, (length) => {
  if (length === 0) dismiss(false);
});

onUnmounted(removeListeners);

const triggerAttrs = computed(() => ({
  "aria-haspopup": "menu" as const,
  "aria-expanded": isOpen.value,
  "aria-controls": menuId,
  "data-menu-trigger": "",
}));

defineExpose({ present, presentAt, dismiss: () => dismiss(), toggle });
</script>

<template>
  <span v-if="$slots.trigger" ref="anchor" class="inline-flex">
    <slot name="trigger" :presented="isOpen" :toggle="toggle" :attrs="triggerAttrs" />
  </span>

  <Teleport to="body">
    <Transition enter-active-class="transition-opacity duration-motion-fast ease-motion-standard" enter-from-class="opacity-0"
      leave-active-class="pointer-events-none transition-opacity duration-motion-fast ease-motion-standard" leave-to-class="opacity-0">
      <div v-if="isOpen" :id="menuId" ref="panel" role="menu" :aria-label="props.label" v-bind="{ [INERT_SKIP_ATTR]: '' }" :style="style"
        class="z-10001 min-w-52 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-menu bg-surface-overlay p-1.5 text-content-strong shadow-float outline-none compact:min-w-60 compact:p-0"
        @keydown="onPanelKeydown">
        <template v-for="row in rows" :key="row.kind === 'item' ? row.item.id : row.key">
          <div v-if="row.kind === 'separator'" role="separator"
            class="mx-2.5 my-1.5 h-px bg-border-separator compact:mx-0 compact:my-0 compact:h-2 compact:bg-fill"></div>
          <button v-else type="button" :role="row.item.checked === undefined ? 'menuitem' : 'menuitemradio'"
            :aria-checked="row.item.checked === undefined ? undefined : row.item.checked" :disabled="row.item.disabled || row.item.processing"
            :aria-busy="row.item.processing || undefined" :data-menu-item="row.item.id"
            class="group flex min-h-8 w-full cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-1 text-left text-subheadline font-normal outline-none disabled:cursor-default disabled:opacity-45 compact:min-h-11 compact:rounded-none compact:border-t compact:border-border-separator compact:px-4 compact:text-body compact:first:border-t-0 compact:[[role=separator]+&]:border-t-0"
            :class="row.item.tone === 'critical'
              ? 'text-content-destructive hover:bg-status-danger-surface focus-visible:bg-status-danger-surface'
              : 'hover:bg-tint hover:text-content-on-tint focus-visible:bg-tint focus-visible:text-content-on-tint compact:hover:bg-fill compact:hover:text-content-strong compact:focus-visible:bg-fill compact:focus-visible:text-content-strong'"
            @click="choose(row.item)">
            <Icon v-if="row.item.processing" name="loader4Line" :size="16" class="animate-spin compact:order-last" />
            <Icon v-else-if="row.item.icon" :name="row.item.icon" :size="16" class="compact:order-last compact:w-5" />
            <ToneDot v-if="row.item.dot" :tone="row.item.dot" data-menu-dot />
            <span class="min-w-0 flex-1 truncate">{{ row.item.label }}</span>
            <Icon v-if="row.item.checked" name="checkCustom" :size="16" data-menu-tick
              class="shrink-0 text-content-link compact:order-last" />
            <span v-if="row.item.shortcut" aria-hidden="true" class="shrink-0 text-footnote opacity-60 compact:hidden">{{ row.item.shortcut }}</span>
          </button>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>
