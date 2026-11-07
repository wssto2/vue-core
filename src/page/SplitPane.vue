<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useMediaQuery } from "../internal/mediaQuery";

/**
 * Two panes with a draggable divider: `start` (left, or top) and `end`. `v-model:size` is the share of the start pane, 0 to 1 (default 0.5);
 * `min` and `max` bound the start pane in pixels, and the end pane always keeps at least `min` too. The divider is a
 * `role="separator"` that takes focus: ←/→ (↑/↓ in a vertical split) move it by 2 %, Shift by 10 %, Home and End go to the limits;
 * `aria-valuenow` is the start pane's percentage. A `storage-key` remembers the size in this browser (localStorage, under `vue-core:split:<key>`;
 * where storage is not available the size is simply not remembered). Below `stack-below` (default `lg`) the panes stack, each at its natural
 * height, and there is no divider.
 *
 * The pane is as tall as its parent (`h-full`): give the parent a height, or put it in a `WorkbenchPage`.
 *
 *   <SplitPane v-model:size="size" storage-key="template-editor" :min="320">
 *     <template #start><CodeEditor fill … /></template>
 *     <template #end><PreviewFrame … /></template>
 *   </SplitPane>
 */
const props = withDefaults(defineProps<{
  /** `horizontal`: the panes sit side by side; `vertical`: one above the other. */
  orientation?: "horizontal" | "vertical";
  /** Smallest pane, in pixels. */
  min?: number;
  /** Largest start pane, in pixels. */
  max?: number;
  storageKey?: string;
  /** Below this width the panes stack. */
  stackBelow?: "md" | "lg" | "xl";
  /** The accessible name of the divider. */
  label?: string;
}>(), { orientation: "horizontal", min: 160, max: undefined, storageKey: undefined, stackBelow: "lg", label: undefined });

const size = defineModel<number>("size", { default: 0.5 });
defineSlots<{ start?: () => unknown; end?: () => unknown }>();

const { t } = useI18n();
const BREAKPOINTS = { md: "48rem", lg: "64rem", xl: "80rem" } as const;
const wide = useMediaQuery(`(min-width: ${BREAKPOINTS[props.stackBelow]})`);
const root = useTemplateRef<HTMLElement>("root");
const total = ref(0); // the pane's length along the split, in pixels (0 until measured)
const vertical = computed(() => props.orientation === "vertical");
const storageName = computed(() => (props.storageKey ? `vue-core:split:${props.storageKey}` : null));

/** The size within the limits: min and max in pixels (once the pane has been measured), and 0 to 1 anyway. */
function clamp(value: number): number {
  let low = 0;
  let high = 1;
  if (total.value > 0) {
    low = Math.min(props.min / total.value, 0.5);
    high = Math.max(1 - props.min / total.value, 0.5);
    if (props.max !== undefined) high = Math.min(high, Math.max(props.max / total.value, low));
  }
  return Math.min(Math.max(Number.isFinite(value) ? value : 0.5, low), high);
}
const effective = computed(() => clamp(size.value));
const percent = computed(() => Math.round(effective.value * 100));

function remember(value: number) {
  if (!storageName.value) return;
  try {
    localStorage.setItem(storageName.value, String(value));
  } catch { /* storage is blocked or full: the size is just not remembered */ }
}
function set(value: number) {
  const next = clamp(value);
  size.value = next;
  remember(next);
}

function measure() {
  const box = root.value?.getBoundingClientRect();
  total.value = box ? (vertical.value ? box.height : box.width) : 0;
}

let observer: ResizeObserver | undefined;
onMounted(() => {
  if (storageName.value) {
    try {
      const stored = Number.parseFloat(localStorage.getItem(storageName.value) ?? "");
      if (stored > 0 && stored < 1) size.value = stored;
    } catch { /* no storage */ }
  }
  measure();
  if (typeof ResizeObserver !== "undefined" && root.value) {
    observer = new ResizeObserver(measure);
    observer.observe(root.value);
  }
});
onBeforeUnmount(() => observer?.disconnect());
watch(vertical, measure);

function onKey(event: KeyboardEvent) {
  const [less, more] = vertical.value ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
  const step = event.shiftKey ? 0.1 : 0.02;
  let next: number;
  if (event.key === less) next = effective.value - step;
  else if (event.key === more) next = effective.value + step;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = 1;
  else return;
  event.preventDefault();
  set(next);
}

function onPointerDown(event: PointerEvent) {
  const handle = event.currentTarget as HTMLElement;
  handle.setPointerCapture?.(event.pointerId);
  const move = (next: PointerEvent) => {
    const box = root.value?.getBoundingClientRect();
    if (!box || !(total.value > 0)) return;
    set(vertical.value ? (next.clientY - box.top) / box.height : (next.clientX - box.left) / box.width);
  };
  const end = () => {
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", end);
    handle.removeEventListener("pointercancel", end);
  };
  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}
</script>

<template>
  <div ref="root" data-split-pane class="flex min-h-0 min-w-0" :class="[vertical ? 'flex-col' : 'flex-row', wide ? 'h-full' : 'flex-col']" :data-stacked="!wide || undefined">
    <div class="min-h-0 min-w-0 overflow-hidden" :style="wide ? { flex: `0 0 ${effective * 100}%`, ...(vertical ? { minHeight: `${props.min}px` } : { minWidth: `${props.min}px` }) } : undefined">
      <slot name="start" />
    </div>
    <div v-if="wide" role="separator" tabindex="0" data-split-handle :aria-orientation="vertical ? 'horizontal' : 'vertical'" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100"
      :aria-label="props.label ?? t('core.page.split.resize')"
      class="group relative z-10 shrink-0 touch-none bg-border-separator outline-none focus-visible:bg-border-focus"
      :class="vertical ? 'h-px w-full cursor-row-resize' : 'h-full w-px cursor-col-resize'" @keydown="onKey" @pointerdown="onPointerDown">
      <!-- A wider target than the hairline, and a visible grip on hover and focus. -->
      <span aria-hidden="true" class="absolute transition-colors group-hover:bg-border-focus/20 group-focus-visible:bg-border-focus/20" :class="vertical ? 'inset-x-0 -top-1 h-2' : 'inset-y-0 -left-1 w-2'" />
    </div>
    <div class="min-h-0 min-w-0 flex-1 overflow-hidden" :class="wide ? '' : 'border-t border-border-separator'">
      <slot name="end" />
    </div>
  </div>
</template>
