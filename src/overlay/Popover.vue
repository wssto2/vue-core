<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, useId, watch } from "vue";
import type { Placement } from "@floating-ui/dom";
import { focusableWithin } from "../internal/focusable";
import { NARROW_VIEWPORT, arrowSide, useAnchoredPosition } from "./anchored";
import { CLOSE_OVERLAYS_EVENT } from "./closeOverlays";

/**
 * A small, interactive panel anchored to the element that opened it.
 *
 *   <Popover placement="top-end" :label="t('saveFilter')">
 *     <template #trigger="{ toggle, attrs }">
 *       <Button v-bind="attrs" @click="toggle">Save filter</Button>
 *     </template>
 *     <template #default="{ dismiss }">…one or two fields…</template>
 *   </Popover>
 *
 * Between the overlays: a `Tooltip` is hover text; a `Popover` is a click, one or two fields or a
 * short list, no scrolling; a `Modal` or `Sheet` is anything larger or with validation across fields.
 *
 * Positioned against the trigger (flips, shifts, follows scroll and the on-screen keyboard); on
 * narrow screens it spans the width minus a gutter. Opening focuses the first control inside (or
 * the panel). Escape closes the popover only (it is caught before an enclosing dialog sees it) and
 * returns focus to the trigger; a press outside, or focus leaving, closes without stealing focus.
 * It renders in place, not teleported, so an enclosing dialog does not make it inert and its focus
 * trap includes it.
 */
const props = withDefaults(defineProps<{
  /** The accessible name of the panel. */
  label: string;
  placement?: Placement;
  /** Panel width on wide screens; `auto` is as wide as the content (a date and time picker). */
  width?: "sm" | "md" | "lg" | "auto";
  arrow?: boolean;
  /** On wide screens the panel is at least as wide as its trigger (a select's list is never narrower than the field); `width` stays its minimum. */
  matchTriggerWidth?: boolean;
  /** The trigger fills its container (a full-width sidebar row). */
  block?: boolean;
  /** Focus moves into the panel when it opens. `false` where the trigger is a field that keeps being typed into (a date). */
  autofocus?: boolean;
}>(), {
  placement: "bottom",
  width: "lg",
  arrow: true,
  matchTriggerWidth: false,
  block: false,
  autofocus: true,
});

const emit = defineEmits<{ presented: []; dismissed: [] }>();

defineSlots<{
  trigger: (scope: {
    presented: boolean;
    toggle: () => void;
    attrs: { "aria-expanded": boolean; "aria-haspopup": "dialog"; "aria-controls": string };
  }) => unknown;
  default: (scope: { dismiss: () => void }) => unknown;
}>();

/** Viewport edge gutter; also the width breakpoint for spanning the screen. */
const GUTTER = 12;
const WIDTH = { sm: "w-56", md: "w-72", lg: "w-80", auto: "w-max" } as const;

const panelId = `popover-${useId()}`;
const isOpen = ref(false);
const anchor = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const arrowEl = ref<HTMLElement | null>(null);

const { style, arrowStyle, resolvedPlacement } = useAnchoredPosition(panel, {
  reference: () => anchor.value?.firstElementChild ?? anchor.value,
  placement: () => props.placement,
  offset: 10,
  padding: GUTTER,
  arrow: arrowEl,
  fit: (floating, available) => {
    const trigger = anchor.value?.firstElementChild ?? anchor.value;
    Object.assign(floating.style, window.innerWidth < NARROW_VIEWPORT
      ? { width: `${window.innerWidth - GUTTER * 2}px`, maxWidth: "", minWidth: "" }
      : { width: "", maxWidth: `${Math.max(0, available.width)}px`, minWidth: props.matchTriggerWidth && trigger ? `${Math.round(trigger.getBoundingClientRect().width)}px` : "" });
  },
});

function present() {
  if (isOpen.value) return;
  isOpen.value = true;
  emit("presented");
}

function dismiss(restoreFocus = false) {
  if (!isOpen.value) return;
  isOpen.value = false;
  emit("dismissed");
  if (restoreFocus) void nextTick(() => focusableWithin(anchor.value)[0]?.focus());
}

function toggle() {
  if (isOpen.value) dismiss();
  else present();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  // Capture phase on window: runs before the dialog's document listener.
  event.preventDefault();
  event.stopPropagation();
  dismiss(true);
}

function isInside(target: EventTarget | null): boolean {
  return target instanceof Node && (!!panel.value?.contains(target) || !!anchor.value?.contains(target));
}

function onPointerDown(event: PointerEvent) {
  if (!isInside(event.target)) dismiss();
}

function onFocusOut(event: FocusEvent) {
  // relatedTarget null: focus left the document (or went to a non-focusable spot, which a
  // pointer press already handles).
  if (event.relatedTarget && !isInside(event.relatedTarget)) dismiss();
}

watch(panel, (element) => {
  if (element && props.autofocus) void nextTick(() => (focusableWithin(element)[0] ?? element).focus({ preventScroll: true }));
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

onUnmounted(removeListeners);

const triggerAttrs = computed(() => ({
  "aria-expanded": isOpen.value,
  "aria-haspopup": "dialog" as const,
  "aria-controls": panelId,
}));

defineExpose({ present, dismiss: () => dismiss(), toggle });
</script>

<template>
  <span :class="props.block ? 'flex w-full' : 'inline-flex max-w-full min-w-0'" @focusout="onFocusOut">
    <span ref="anchor" :class="props.block ? 'flex w-full' : 'inline-flex max-w-full min-w-0'">
      <slot name="trigger" :presented="isOpen" :toggle="toggle" :attrs="triggerAttrs" />
    </span>

    <!-- Opacity only: a scale transform would skew the size floating-ui measures. -->
    <Transition enter-active-class="transition-opacity duration-motion-fast ease-motion-standard" enter-from-class="opacity-0"
      leave-active-class="pointer-events-none transition-opacity duration-motion-fast ease-motion-standard" leave-to-class="opacity-0">
      <div v-if="isOpen" :id="panelId" ref="panel" role="dialog" :aria-label="props.label" tabindex="-1"
        class="z-1000 rounded-menu bg-surface-overlay p-3 text-content-strong shadow-float outline-none"
        :class="WIDTH[props.width]" :style="style">
        <slot :dismiss="() => dismiss(true)" />
        <span v-if="props.arrow" ref="arrowEl" aria-hidden="true" class="absolute size-2.5 rotate-45 bg-surface-overlay" :class="{
          '-bottom-[5px]': arrowSide(resolvedPlacement) === 'bottom',
          '-top-[5px]': arrowSide(resolvedPlacement) === 'top',
          '-left-[5px]': arrowSide(resolvedPlacement) === 'left',
          '-right-[5px]': arrowSide(resolvedPlacement) === 'right',
        }" :style="arrowStyle" />
      </div>
    </Transition>
  </span>
</template>
