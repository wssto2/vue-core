<script lang="ts">
import { ref } from "vue";
import { perDocument } from "../internal/perDocument";

/** One action behind a swiped row: a link (call, message, e-mail). */
export interface SwipeAction {
  key: string;
  label: string;
  icon: IconName;
  href: string;
  tone: "positive" | "info" | "neutral" | "critical";
  /** Opens in a new tab or the external app (a messaging link). */
  external?: boolean;
}

const OPEN_ROW = Symbol("vue-core:swipe-open-row");
/** The one open row of the page: opening a row closes the others. */
const openRow = () => perDocument(OPEN_ROW, () => ref<symbol | null>(null));
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from "vue";
import { Icon, type IconName } from "../icon";

/**
 * Swipe a row left to reveal quick actions behind it (iOS Mail, Contacts): call, message,
 * e-mail. Touch only: a mouse never drags it, and desktop keeps its own buttons. Vertical
 * scrolling stays the browser's (`touch-action: pan-y`); only a mostly horizontal drag moves the
 * row. Essential actions must also exist without the gesture.
 *
 *   <SwipeActions :actions="[{ key: 'call', label: t('call'), icon: 'phoneLine', href: 'tel:…', tone: 'positive' }]">
 *     …row content…
 *   </SwipeActions>
 *
 * One row is open at a time. After a drag the row's own click is swallowed, so a swipe never
 * also opens the record; tapping an open row closes it.
 */
const props = withDefaults(defineProps<{
  actions: readonly SwipeAction[];
  /** Classes for the sliding content (the row's own padding). */
  contentClass?: string;
}>(), { contentClass: "" });

defineSlots<{ default?: () => unknown }>();

const ACTION_WIDTH = 76;
// Solid status fills carry white text in both appearances.
const TONES = {
  positive: "bg-status-success-solid",
  info: "bg-status-info-solid",
  neutral: "bg-status-neutral-solid",
  critical: "bg-status-danger-solid",
} as const satisfies Record<SwipeAction["tone"], string>;

const sharedOpen = openRow();
const self = Symbol("swipe-row");
const width = computed(() => props.actions.length * ACTION_WIDTH);
const offset = ref(0);
const dragging = ref(false);

let startX = 0;
let startY = 0;
let startOffset = 0;
let horizontal: boolean | null = null;
let swallowClick = false;

function onPointerDown(event: PointerEvent) {
  // A new touch: whatever click the previous drag could have produced is past (browsers often
  // send none after a drag), so this touch's own tap counts.
  swallowClick = false;
  if (event.pointerType !== "touch" || props.actions.length === 0) return;

  startX = event.clientX;
  startY = event.clientY;
  startOffset = offset.value;
  horizontal = null;
}

function onPointerMove(event: PointerEvent) {
  if (event.pointerType !== "touch" || props.actions.length === 0) return;

  const dx = event.clientX - startX;
  const dy = event.clientY - startY;
  if (horizontal === null) {
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
    horizontal = Math.abs(dx) > Math.abs(dy);
  }
  if (!horizontal) return;

  dragging.value = true;
  offset.value = Math.min(0, Math.max(-width.value - 24, startOffset + dx));
}

function close() {
  offset.value = 0;
  if (sharedOpen.value === self) sharedOpen.value = null;
}

function settle() {
  if (!dragging.value) return;

  dragging.value = false;
  swallowClick = true;
  const open = -offset.value > width.value / 2;
  offset.value = open ? -width.value : 0;
  if (open) sharedOpen.value = self;
  else if (sharedOpen.value === self) sharedOpen.value = null;
}

// Capture phase: runs before the row's (and the list's) own click handlers.
function onClickCapture(event: MouseEvent) {
  if (swallowClick) {
    swallowClick = false;
    event.stopPropagation();
    event.preventDefault();
    return;
  }

  if (offset.value !== 0 && !(event.target as HTMLElement).closest("[data-swipe-action]")) {
    event.stopPropagation();
    event.preventDefault();
    close();
  }
}

// Opening another row closes this one.
watch(sharedOpen, (open) => {
  if (open !== self && offset.value !== 0 && !dragging.value) offset.value = 0;
});

onBeforeUnmount(() => {
  if (sharedOpen.value === self) sharedOpen.value = null;
});
</script>

<template>
  <div class="relative overflow-hidden" data-test="swipe-row" @click.capture="onClickCapture">
    <!-- The actions, behind the row on the right. -->
    <div class="absolute inset-y-0 right-0 flex" :style="{ width: `${width}px` }" :aria-hidden="offset === 0">
      <a v-for="action in props.actions" :key="action.key" :href="action.href" data-swipe-action
        :target="action.external ? '_blank' : undefined" :rel="action.external ? 'noopener' : undefined"
        :tabindex="offset === 0 ? -1 : 0" :data-action="action.key"
        class="flex flex-1 flex-col items-center justify-center gap-1 text-footnote font-semibold text-white"
        :class="TONES[action.tone]" @click="close">
        <Icon :name="action.icon" :size="22" />
        {{ action.label }}
      </a>
    </div>

    <div class="relative touch-pan-y bg-surface-cell"
      :class="[props.contentClass, dragging ? '' : 'transition-transform duration-motion-normal ease-motion-standard']"
      :style="{ transform: `translateX(${offset}px)` }" @pointerdown="onPointerDown" @pointermove="onPointerMove"
      @pointerup="settle" @pointercancel="settle">
      <slot />
    </div>
  </div>
</template>
