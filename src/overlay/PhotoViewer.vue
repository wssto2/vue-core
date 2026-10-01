<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";
import { clampPan, drawnSize, MAX_ZOOM, miniMap, panToFraction, stepZoom, turned, zoomAt, type Point, type Size } from "./photoGeometry";
import { useDialog } from "./useDialog";

/** One photograph of a viewer. */
export interface PhotoViewerItem {
  /** The full picture. */
  readonly src: string;
  /** A small version for the strip and the mini-map; the picture itself when there is none. */
  readonly thumb?: string;
  /** What the picture shows: the strip's button names and the screen reader's description. */
  readonly alt: string;
  /** The file name Download suggests (it only applies to a picture served from this origin). */
  readonly downloadName?: string;
}

/**
 * A full-screen dark viewer for a set of photographs: zoom (buttons, wheel, pinch, double tap or double click, 100–500 %),
 * drag to move a zoomed photo with a mini-map showing where you are, rotate, download, previous and next (buttons, swipe, arrow keys)
 * and a strip of thumbnails. It is a dialog like `Modal`: the page behind is inert, Tab stays inside, Escape closes and focus goes back
 * to what opened it. Under reduced motion nothing animates.
 *
 * Keys: ← → photos, + − zoom, 0 fits the screen again, R rotates, Esc closes. `#actions` (given the photo on show) adds your own buttons to the header:
 * "Make cover", "Delete".
 *
 *   <PhotoViewer ref="viewer" :items="photos" title="VW Golf 8" />
 *   <button @click="viewer?.present(index)">…</button>        viewer.value?.dismiss()
 */
const props = withDefaults(defineProps<{
  items: readonly PhotoViewerItem[];
  /** Before the counter in the header ("VW Golf 8 · 3 / 12"). */
  title?: string;
}>(), { title: undefined });

/** The photograph on show (0-based). */
const index = defineModel<number>("index", { default: 0 });
const emit = defineEmits<{ presented: []; dismissed: [] }>();

defineSlots<{
  /** Next to the zoom buttons: what the app does with the photo on show (make it the cover, delete it). */
  actions?: (scope: { item: PhotoViewerItem; index: number }) => unknown;
}>();

const { t } = useI18n();
const panel = ref<HTMLElement | null>(null);
const stageElement = useTemplateRef<HTMLElement>("stage");
const imageElement = useTemplateRef<HTMLImageElement>("image");
const strip = useTemplateRef<HTMLElement>("strip");

const dialog = useDialog(panel, { initialFocus: "panel", onPresented: () => emit("presented"), onDismissed: () => emit("dismissed") });
const { isOpen } = dialog;

// Keeps the teleported wrapper until the leave transition ends.
const isMounted = ref(false);
watch(isOpen, (open) => {
  if (open) isMounted.value = true;
}, { flush: "sync" });
const unmountIfClosed = () => {
  if (!isOpen.value) isMounted.value = false;
};

// ---- the view: zoom, pan and rotation of the photograph on show, and what it is measured against
const zoom = ref(1);
const pan = ref<Point>({ x: 0, y: 0 });
const turns = ref(0);
const natural = ref<Size>({ width: 0, height: 0 });
const stage = ref<Size>({ width: 0, height: 0 });
const swipe = ref(0);
const gesturing = ref(false);
// Which way the photo came in from; none for the first one, which only fades in with the dialog.
const direction = ref<"forward" | "back" | null>(null);

const item = computed(() => props.items[index.value]);
const drawn = computed(() => drawnSize(natural.value, stage.value, turns.value));
const visible = computed(() => turned(drawn.value, turns.value));
const loaded = computed(() => drawn.value.width > 0);
const percent = computed(() => Math.round(zoom.value * 100));
const zoomed = computed(() => zoom.value > 1.001);
const hasPrevious = computed(() => index.value > 0);
const hasNext = computed(() => index.value < props.items.length - 1);

const imageStyle = computed(() => ({
  width: `${drawn.value.width}px`,
  height: `${drawn.value.height}px`,
  marginLeft: `${-drawn.value.width / 2}px`,
  marginTop: `${-drawn.value.height / 2}px`,
  transform: `translate(${pan.value.x + swipe.value}px, ${pan.value.y}px) scale(${zoom.value}) rotate(${turns.value * 90}deg)`,
}));

function resetView() {
  zoom.value = 1;
  pan.value = { x: 0, y: 0 };
  swipe.value = 0;
}

function measure() {
  const element = stageElement.value;
  if (element) stage.value = { width: element.clientWidth, height: element.clientHeight };
  // A cached picture fires `load` before anyone listens.
  onLoad();
}
function onLoad() {
  const image = imageElement.value;
  if (image && image.naturalWidth > 0) natural.value = { width: image.naturalWidth, height: image.naturalHeight };
}

let observer: ResizeObserver | null = null;
watch(stageElement, (element) => {
  observer?.disconnect();
  if (!element) return;
  measure();
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(() => {
      measure();
      pan.value = clampPan(pan.value, visible.value, stage.value, zoom.value);
    });
    observer.observe(element);
  }
});
onBeforeUnmount(() => observer?.disconnect());

watch(index, () => {
  resetView();
  turns.value = 0;
  natural.value = { width: 0, height: 0 };
  void nextTick(() => {
    onLoad();
    strip.value?.querySelector("[aria-current=true]")?.scrollIntoView?.({ inline: "center", block: "nearest" });
  });
});
watch(() => props.items.length, (length) => {
  if (length === 0) void dialog.dismiss();
  else if (index.value > length - 1) index.value = length - 1;
});

function present(at = 0) {
  index.value = Math.min(Math.max(0, at), Math.max(0, props.items.length - 1));
  resetView();
  turns.value = 0;
  natural.value = { width: 0, height: 0 };
  direction.value = null;
  dialog.present();
  void nextTick(measure);
}
const dismiss = () => dialog.dismiss();
defineExpose({ present, dismiss });

// ---- commands
function go(delta: 1 | -1) {
  const next = index.value + delta;
  if (next < 0 || next > props.items.length - 1) return;
  direction.value = delta === 1 ? "forward" : "back";
  index.value = next;
}
function zoomBy(delta: 1 | -1) {
  setZoom(stepZoom(zoom.value, delta), { x: 0, y: 0 });
}
function setZoom(next: number, focus: Point) {
  const view = zoomAt({ zoom: zoom.value, pan: pan.value }, next, focus, visible.value, stage.value);
  zoom.value = view.zoom;
  pan.value = view.pan;
}
function rotate() {
  turns.value = (turns.value + 3) % 4; // counter-clockwise, like the icon
  pan.value = clampPan(pan.value, visible.value, stage.value, zoom.value);
}

function onKeydown(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const commands: Record<string, () => void> = {
    ArrowLeft: () => go(-1),
    ArrowRight: () => go(1),
    "+": () => zoomBy(1),
    "=": () => zoomBy(1),
    "-": () => zoomBy(-1),
    _: () => zoomBy(-1),
    "0": resetView,
    r: rotate,
    R: rotate,
  };
  const command = commands[event.key];
  if (!command) return;
  event.preventDefault();
  command();
}

// ---- pointer gestures on the stage
const fromCentre = (event: { clientX: number; clientY: number }): Point => {
  const box = stageElement.value?.getBoundingClientRect();
  return { x: event.clientX - (box ? box.left + box.width / 2 : 0), y: event.clientY - (box ? box.top + box.height / 2 : 0) };
};

const pointers = new Map<number, Point>();
let moved = false;
let startedAt = 0;
let travelled: Point = { x: 0, y: 0 };
let lastTap: { at: number; point: Point } | null = null;
const TAP_SLOP = 8;
const DOUBLE_TAP_MS = 300;

const middle = (): Point => {
  const [a, b] = [...pointers.values()];
  return { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 };
};
const spread = (): number => {
  const [a, b] = [...pointers.values()];
  return Math.hypot(a!.x - b!.x, a!.y - b!.y);
};

function onPointerDown(event: PointerEvent) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  stageElement.value?.setPointerCapture?.(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  gesturing.value = true;
  if (pointers.size === 1) {
    moved = false;
    startedAt = Date.now();
    travelled = { x: 0, y: 0 };
  } else moved = true; // a second finger: a pinch, never a tap
}

function onPointerMove(event: PointerEvent) {
  const before = pointers.get(event.pointerId);
  if (!before) return;
  const now = { x: event.clientX, y: event.clientY };
  if (pointers.size === 2) {
    const [distance, centre] = [spread(), middle()];
    pointers.set(event.pointerId, now);
    const after = middle();
    setZoom(zoom.value * (spread() / (distance || 1)), fromCentre({ clientX: after.x, clientY: after.y }));
    pan.value = clampPan({ x: pan.value.x + after.x - centre.x, y: pan.value.y + after.y - centre.y }, visible.value, stage.value, zoom.value);
    return;
  }
  pointers.set(event.pointerId, now);
  const delta = { x: now.x - before.x, y: now.y - before.y };
  travelled = { x: travelled.x + delta.x, y: travelled.y + delta.y };
  if (!moved && Math.hypot(travelled.x, travelled.y) < TAP_SLOP) return;
  moved = true;
  if (zoomed.value) pan.value = clampPan({ x: pan.value.x + delta.x, y: pan.value.y + delta.y }, visible.value, stage.value, zoom.value);
  else swipe.value = (swipe.value + delta.x) * ((swipe.value + delta.x < 0 && !hasNext.value) || (swipe.value + delta.x > 0 && !hasPrevious.value) ? 0.6 : 1);
}

function onPointerUp(event: PointerEvent, cancelled = false) {
  if (!pointers.delete(event.pointerId)) return;
  if (pointers.size > 0) return;
  gesturing.value = false;
  const point = fromCentre(event);
  if (!moved && !cancelled) {
    const double = lastTap && Date.now() - lastTap.at < DOUBLE_TAP_MS && Math.hypot(point.x - lastTap.point.x, point.y - lastTap.point.y) < 32;
    lastTap = double ? null : { at: Date.now(), point };
    if (double) {
      if (zoomed.value) {
        resetView();
      } else setZoom(2, point);
    }
    return;
  }
  const flick = Date.now() - startedAt < 250 && Math.abs(swipe.value) > 30;
  const far = Math.abs(swipe.value) > Math.max(50, stage.value.width * 0.15);
  const dx = swipe.value;
  swipe.value = 0;
  if (!cancelled && !zoomed.value && (far || flick)) go(dx < 0 ? 1 : -1);
}

function onWheel(event: WheelEvent) {
  const unit = event.deltaMode === 1 ? 16 : 1;
  setZoom(zoom.value * Math.exp((-event.deltaY * unit) * (event.ctrlKey ? 0.01 : 0.0015)), fromCentre(event));
}

// ---- the mini-map
const MAP_BOX: Size = { width: 120, height: 80 };
const map = computed(() => (loaded.value ? miniMap(visible.value, stage.value, zoom.value, pan.value, MAP_BOX) : null));
function onMap(event: PointerEvent) {
  if (event.type === "pointermove" && event.buttons === 0) return;
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return;
  pan.value = panToFraction({ x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height }, visible.value, stage.value, zoom.value);
}
const mapThumb = computed(() => {
  if (!map.value) return {};
  const { width, height } = turns.value % 2 === 0 ? map.value.image : { width: map.value.image.height, height: map.value.image.width };
  return { width: `${width}px`, height: `${height}px`, marginLeft: `${-width / 2}px`, marginTop: `${-height / 2}px`, transform: `rotate(${turns.value * 90}deg)` };
});

onMounted(() => {
  if (isOpen.value) measure();
});

// A button at the end of its range stays focusable (aria-disabled): a disabled one would drop focus out of the dialog and the arrow keys with it.
const BUTTON = "flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/8 text-[#f1f5f3] transition-colors duration-motion-fast hover:bg-white/16 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6ee7b7] aria-disabled:cursor-default aria-disabled:opacity-30 aria-disabled:hover:bg-white/8";
const label = computed(() => props.title ?? t("core.viewer.label"));
</script>

<template>
  <Teleport to="body">
    <div v-if="isMounted" class="relative z-9999">
      <transition appear enter-active-class="transition-opacity duration-motion-normal ease-motion-standard" enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-motion-normal ease-motion-standard" leave-to-class="opacity-0" @after-leave="unmountIfClosed">
        <div v-if="isOpen" ref="panel" role="dialog" aria-modal="true" :aria-label="label" tabindex="-1" data-part="panel" data-test="photo-viewer"
          class="fixed inset-0 flex flex-col bg-[#0b1210] text-[#f1f5f3] outline-none" @keydown="onKeydown">
          <div class="flex items-center gap-2 px-4 pt-[max(0.875rem,var(--app-safe-top))] pb-3.5 md:px-4.5">
            <h2 class="min-w-0 truncate text-headline font-semibold">
              <span v-if="props.title">{{ props.title }} · </span><span aria-live="polite" data-test="photo-counter">{{ t("core.viewer.counter", { current: index + 1, total: props.items.length }) }}</span>
            </h2>
            <div class="grow"></div>
            <slot v-if="item" name="actions" :item="item" :index="index"></slot>
            <button type="button" :class="[BUTTON, 'compact:hidden']" :aria-label="t('core.viewer.zoom_out')" :aria-disabled="!zoomed" data-test="zoom-out" @click="zoomBy(-1)"><Icon name="zoomOut" :size="18" /></button>
            <p class="w-13 text-center text-subheadline tabular-nums compact:hidden" data-test="zoom-percent">{{ t("core.viewer.zoom_percent", { percent }) }}</p>
            <button type="button" :class="[BUTTON, 'compact:hidden']" :aria-label="t('core.viewer.zoom_in')" :aria-disabled="zoom >= MAX_ZOOM" data-test="zoom-in" @click="zoomBy(1)"><Icon name="zoomIn" :size="18" /></button>
            <button type="button" :class="BUTTON" :aria-label="t('core.viewer.rotate')" data-test="rotate" @click="rotate"><Icon name="rotateCounterclockwise" :size="18" /></button>
            <a v-if="item" :href="item.src" :download="item.downloadName ?? ''" target="_blank" rel="noopener" :class="BUTTON" :aria-label="t('core.viewer.download')" data-test="download"><Icon name="download" :size="18" /></a>
            <button type="button" :class="[BUTTON, 'bg-white/16']" :aria-label="t('core.actions.close')" data-test="close" @click="dismiss"><Icon name="close" :size="18" /></button>
          </div>

          <div class="flex min-h-0 grow items-center gap-4 px-4 md:px-4.5">
            <button v-if="props.items.length > 1" type="button" :class="[BUTTON, 'size-12 compact:hidden']" :aria-label="t('core.viewer.previous')" :aria-disabled="!hasPrevious" data-test="previous" @click="go(-1)"><Icon name="arrowLeftSLine" :size="22" /></button>
            <div ref="stage" data-test="photo-stage" class="relative h-full min-w-0 grow touch-none overflow-hidden rounded-md select-none"
              :class="zoomed ? 'cursor-grab active:cursor-grabbing' : ''"
              @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp($event)" @pointercancel="onPointerUp($event, true)" @wheel.prevent="onWheel">
              <img v-if="item" :key="item.src" ref="image" :src="item.src" :alt="item.alt" draggable="false" data-test="photo"
                class="absolute top-1/2 left-1/2 max-w-none"
                :class="[loaded ? '' : 'opacity-0', gesturing ? '' : 'transition-transform duration-motion-normal ease-motion-standard', direction === 'back' ? 'animate-step-back' : direction === 'forward' ? 'animate-step-in' : '']"
                :style="imageStyle" @load="onLoad" />
              <div v-if="zoomed && map" data-test="mini-map" class="absolute right-3.5 bottom-3.5 overflow-hidden rounded-md bg-black/50 ring-1 ring-white/20"
                :style="{ width: `${map.image.width}px`, height: `${map.image.height}px` }" @pointerdown.stop="onMap" @pointermove.stop="onMap">
                <img v-if="item" :src="item.thumb ?? item.src" alt="" draggable="false" class="pointer-events-none absolute top-1/2 left-1/2 max-w-none opacity-80" :style="mapThumb" />
                <span class="pointer-events-none absolute rounded-xs ring-2 ring-[#6ee7b7]" data-test="mini-map-view"
                  :style="{ left: `${map.view.x}px`, top: `${map.view.y}px`, width: `${map.view.width}px`, height: `${map.view.height}px` }"></span>
              </div>
            </div>
            <button v-if="props.items.length > 1" type="button" :class="[BUTTON, 'size-12 compact:hidden']" :aria-label="t('core.viewer.next')" :aria-disabled="!hasNext" data-test="next" @click="go(1)"><Icon name="arrowRightSLine" :size="22" /></button>
          </div>

          <ul v-if="props.items.length > 1" ref="strip" data-test="photo-strip" class="flex shrink-0 justify-start gap-2 overflow-x-auto px-4 pt-4 pb-[max(1.25rem,var(--app-safe-bottom))] scrollbar-hide md:justify-center md:px-4.5">
            <li v-for="(each, position) in props.items" :key="each.src" class="shrink-0">
              <button type="button" :aria-label="each.alt" :aria-current="position === index ? 'true' : undefined" data-test="thumbnail"
                class="block h-11 w-16 cursor-pointer overflow-hidden rounded-[5px] bg-[#2a3431] transition-opacity duration-motion-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6ee7b7]"
                :class="position === index ? 'ring-2 ring-[#6ee7b7]' : 'opacity-60 hover:opacity-100'"
                @click="direction = position > index ? 'forward' : 'back'; index = position">
                <img :src="each.thumb ?? each.src" alt="" loading="lazy" draggable="false" class="size-full object-cover" />
              </button>
            </li>
          </ul>
          <div v-else class="h-[max(1.25rem,var(--app-safe-bottom))] shrink-0"></div>
          <span class="sr-only" aria-live="polite">{{ item?.alt }}</span>
        </div>
      </transition>
    </div>
  </Teleport>
</template>
