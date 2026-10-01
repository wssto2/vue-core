<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, useTemplateRef, watch } from "vue";
import { useMediaQuery } from "../../internal/mediaQuery";

/**
 * One column of numbers to pick from, two ways. `list`: a scrolling list with the chosen one highlighted (a desktop
 * popover; the mouse wheel scrolls, a click picks). `wheel`: a drum that snaps to its middle number, which is the value
 * (a phone sheet; the finger spins it). Both are a listbox: Arrow keys, Home, End and Page Up and Down change the
 * value, and the value is always one of `values`.
 */
const props = withDefaults(
  defineProps<{
    values: readonly number[];
    label: string;
    variant?: "list" | "wheel";
  }>(),
  { variant: "list" },
);

const model = defineModel<number | null>({ default: null });

/** The height of a number in the wheel, and of the empty space above and below it so the first and last can reach the middle. */
const ITEM = 30;
const WHEEL = 150;
const PAD = (WHEEL - ITEM) / 2;

const id = useId();
const scroller = useTemplateRef<HTMLElement>("scroller");
const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
const index = computed(() => (model.value === null ? -1 : props.values.indexOf(model.value)));
/** Which number is in the middle of the wheel right now (while it turns, before the value follows). */
const centre = ref(Math.max(0, index.value));
let settle: ReturnType<typeof setTimeout> | undefined;

const text = (value: number) => String(value).padStart(2, "0");
const optionId = (value: number) => `${id}-${value}`;

function put(next: number | undefined) {
  if (next !== undefined) model.value = next;
}

function onKeydown(event: KeyboardEvent) {
  const last = props.values.length - 1;
  const at = index.value;
  const target: Record<string, number> = {
    ArrowDown: at < 0 ? 0 : Math.min(last, at + 1),
    ArrowUp: at < 0 ? 0 : Math.max(0, at - 1),
    PageDown: at < 0 ? 0 : Math.min(last, at + 5),
    PageUp: at < 0 ? 0 : Math.max(0, at - 5),
    Home: 0,
    End: last,
  };
  const next = target[event.key];
  if (next === undefined) return;
  event.preventDefault();
  put(props.values[next]);
}

function pick(value: number) {
  put(value);
}

/** Puts the number at `at` in view: in the middle of the wheel, or inside the list. */
function reveal(at: number, instant: boolean) {
  const element = scroller.value;
  if (!element || at < 0 || typeof element.scrollTo !== "function") return;
  const behavior = instant || reduced.value ? "instant" : "smooth";
  if (props.variant === "wheel") {
    if (Math.abs(element.scrollTop - at * ITEM) > 1) element.scrollTo({ top: at * ITEM, behavior });
    return;
  }
  const option = element.querySelector<HTMLElement>(`[data-value="${props.values[at]}"]`);
  if (!option) return;
  const top = option.offsetTop - (element.clientHeight - option.offsetHeight) / 2;
  element.scrollTo({ top: Math.max(0, top), behavior });
}

function onScroll() {
  const element = scroller.value;
  if (props.variant !== "wheel" || !element) return;
  centre.value = Math.min(props.values.length - 1, Math.max(0, Math.round(element.scrollTop / ITEM)));
  clearTimeout(settle);
  settle = setTimeout(() => {
    const value = props.values[centre.value];
    if (value !== undefined && value !== model.value) model.value = value;
  }, 90);
}

onMounted(() => void nextTick(() => reveal(index.value, true)));
onBeforeUnmount(() => clearTimeout(settle));
watch(index, (at) => {
  centre.value = Math.max(0, at);
  reveal(at, false);
});

const away = (position: number) => Math.abs(position - centre.value);
const wheelClass = (position: number) =>
  away(position) === 0 ? "text-[22px] font-semibold text-content-strong" : away(position) === 1 ? "text-[19px] text-content-muted" : "text-base text-content-disabled";
</script>

<template>
  <div v-if="props.variant === 'list'" ref="scroller" role="listbox" tabindex="0" :aria-label="props.label" :aria-activedescendant="index >= 0 ? optionId(props.values[index]!) : undefined"
    class="flex min-w-0 grow flex-col gap-0.5 overflow-y-auto rounded-control [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-border-focus [&::-webkit-scrollbar]:hidden" @keydown="onKeydown">
    <div v-for="value in props.values" :id="optionId(value)" :key="value" role="option" :aria-selected="value === model" :data-value="value"
      class="flex min-h-6.5 shrink-0 cursor-pointer items-center justify-center rounded-md text-body tabular-nums transition-colors duration-motion-fast"
      :class="value === model ? 'bg-tint font-semibold text-content-on-tint' : 'text-content-strong hover:bg-fill'" @click="pick(value)">
      {{ text(value) }}
    </div>
  </div>

  <div v-else ref="scroller" role="listbox" tabindex="0" :aria-label="props.label" :aria-activedescendant="index >= 0 ? optionId(props.values[index]!) : undefined"
    class="relative w-16 snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-control [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-border-focus [&::-webkit-scrollbar]:hidden"
    :style="{ height: `${WHEEL}px` }" @scroll.passive="onScroll" @keydown="onKeydown">
    <div :style="{ height: `${PAD}px` }" aria-hidden="true" />
    <div v-for="(value, position) in props.values" :id="optionId(value)" :key="value" role="option" :aria-selected="value === model" :data-value="value"
      class="flex cursor-pointer snap-center items-center justify-center tabular-nums" :class="wheelClass(position)" :style="{ height: `${ITEM}px` }" @click="pick(value)">
      {{ text(value) }}
    </div>
    <div :style="{ height: `${PAD}px` }" aria-hidden="true" />
  </div>
</template>
