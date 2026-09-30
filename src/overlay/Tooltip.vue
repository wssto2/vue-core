<script setup lang="ts">
import { onUnmounted, ref, useId, watch } from "vue";
import { INERT_SKIP_ATTR } from "./dialogStack";
import { arrowSide, useAnchoredPosition } from "./anchored";

/**
 * A short hint for an element, shown on hover and on keyboard focus, dismissed by Escape, the
 * pointer leaving or focus moving on (it stays while the pointer is over the element, as WCAG
 * 1.4.13 asks). Hover text only: anything interactive or long is a `Popover`.
 *
 *   <Tooltip text="Copy the VIN"><button>…</button></Tooltip>
 *   <Tooltip><template #default="{ describedby }"><button :aria-describedby="describedby">…</button></template>
 *     <template #content>Rich <b>content</b></template></Tooltip>
 *
 * Bind `describedby` (the slot scope) on the focusable element so a screen reader reads the hint
 * with it. The panel is teleported to `<body>` and sits above dialogs.
 */
const props = withDefaults(defineProps<{
  text?: string | null;
  side?: "top" | "bottom" | "left" | "right";
  /** Milliseconds the pointer must rest before the hint shows; keyboard focus shows it at once. */
  delay?: number;
}>(), { text: undefined, side: "top", delay: 0 });

defineSlots<{
  default?: (scope: { describedby: string }) => unknown;
  /** Rich content after `text`. */
  content?: () => unknown;
}>();

const id = `tooltip-${useId()}`;
const visible = ref(false);
const anchor = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const arrowEl = ref<HTMLElement | null>(null);
let timer: ReturnType<typeof setTimeout> | null = null;

const { style, arrowStyle, resolvedPlacement } = useAnchoredPosition(panel, {
  reference: () => anchor.value,
  placement: () => props.side,
  offset: 8,
  padding: 8,
  arrow: arrowEl,
});

function show(delay = 0) {
  clear();
  if (delay > 0) timer = setTimeout(() => (visible.value = true), delay);
  else visible.value = true;
}

function hide() {
  clear();
  visible.value = false;
}

function clear() {
  if (timer) clearTimeout(timer);
  timer = null;
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") hide();
}

watch(visible, (on) => {
  if (on) window.addEventListener("keydown", onKeydown, true);
  else window.removeEventListener("keydown", onKeydown, true);
});

onUnmounted(() => {
  clear();
  window.removeEventListener("keydown", onKeydown, true);
});
</script>

<template>
  <span ref="anchor" class="relative inline-block" @mouseenter="show(props.delay)" @mouseleave="hide" @focusin="show()" @focusout="hide">
    <slot :describedby="id" />
  </span>
  <Teleport to="body">
    <div v-if="visible && (props.text || $slots.content)" :id="id" ref="panel" role="tooltip" v-bind="{ [INERT_SKIP_ATTR]: '' }" :style="style"
      class="pointer-events-none z-10002 w-max max-w-xs rounded-control bg-surface-inverse px-2 py-1 text-xs text-content-inverse shadow-float">
      {{ props.text }}
      <slot name="content" />
      <span ref="arrowEl" aria-hidden="true" class="absolute size-2 rotate-45 bg-surface-inverse" :class="{
        '-bottom-1': arrowSide(resolvedPlacement) === 'bottom',
        '-top-1': arrowSide(resolvedPlacement) === 'top',
        '-left-1': arrowSide(resolvedPlacement) === 'left',
        '-right-1': arrowSide(resolvedPlacement) === 'right',
      }" :style="arrowStyle" />
    </div>
  </Teleport>
</template>
