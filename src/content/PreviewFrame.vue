<script setup lang="ts" generic="In extends { type: string } = PreviewAction, Out extends { type: string } = PreviewCommand">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import Tabs from "../controls/Tabs.vue";
import { Icon } from "../icon";
import { PREVIEW_WIDTHS, parsePreviewAction, previewScale, type PreviewAction, type PreviewCommand, type PreviewDevice } from "./previewFrame";

/**
 * A page shown in an iframe, as the visitor sees it: rendered at the width of a device (`desktop` 1280, `tablet` 768, `mobile` 375 px)
 * and scaled down to fit the pane, with a reload button, a loading state and an error state (the page did not load in time; Retry).
 * The `toolbar` slot adds the app's own controls before the device switch (a page picker, a language switch), the `footer` slot
 * replaces the line under the frame ("Width 1280 px, scaled to 72 %").
 *
 * The page and the editor talk with `postMessage`, both ways typed. A message is accepted only when it comes from this frame's window
 * *and* its origin is `origin` (by default the origin of `src`); anything else is ignored. `@message` gets what `parse` accepts (by default
 * a `PreviewAction`: edit, delete, add, reorder, duplicate, copy-locale), `post()` sends to the page.
 *
 *   <PreviewFrame ref="frame" :src="previewUrl" :title="t('preview')" v-model:device="device" @message="onAction" />
 *   frame.value?.post({ type: "select", id: component.id })
 *
 * `sandbox` defaults to `allow-scripts allow-same-origin allow-forms`, which makes the frame as capable as its own origin: give it a page
 * from your own, trusted site (ideally another origin than the app). A stricter sandbox without `allow-same-origin` makes the page's origin
 * the string "null": then pass `origin="null"`.
 */
const props = withDefaults(defineProps<{
  src: string;
  /** The iframe's accessible name. */
  title: string;
  device?: PreviewDevice;
  sandbox?: string;
  /** The origin messages are accepted from. Default: the origin of `src`. */
  origin?: string;
  /** Reads a message of the page; return null to ignore it. Default: `parsePreviewAction`. */
  parse?: (data: unknown) => In | null;
  /** Milliseconds before a page that has not loaded counts as failed. Default 15000. */
  timeout?: number;
}>(), {
  device: "desktop",
  sandbox: "allow-scripts allow-same-origin allow-forms",
  origin: undefined,
  parse: undefined,
  timeout: 15_000,
});

const emit = defineEmits<{
  /** A message from the page. */
  message: [message: In];
  /** The page finished loading, with how long it took (ms). */
  load: [milliseconds: number];
  /** The page did not load (timeout or the browser's error event). */
  error: [];
  "update:device": [device: PreviewDevice];
}>();

defineSlots<{
  toolbar?: () => unknown;
  footer?: (scope: { width: number; scale: number; device: PreviewDevice; loadMs: number | null }) => unknown;
}>();

const { t } = useI18n();
const frame = useTemplateRef<HTMLIFrameElement>("frame");
const fit = useTemplateRef<HTMLElement>("fit");
const state = ref<"loading" | "loaded" | "failed">("loading");
const loadMs = ref<number | null>(null);
const generation = ref(0);
const pane = ref({ width: 0, height: 0 });
let startedAt = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

const width = computed(() => PREVIEW_WIDTHS[props.device]);
const scale = computed(() => previewScale(pane.value.width, width.value));
const expected = computed(() => props.origin ?? new URL(props.src, window.location.href).origin);
const tabs = computed(() => (Object.keys(PREVIEW_WIDTHS) as PreviewDevice[]).map((value) => ({ value, label: t(`core.preview.${value}`) })));
const frameStyle = computed(() => ({
  width: `${width.value}px`,
  height: pane.value.height > 0 ? `${pane.value.height / scale.value}px` : "100%",
  transform: scale.value < 1 ? `scale(${scale.value})` : undefined,
  transformOrigin: "0 0",
}));
const boxWidth = computed(() => `${width.value * scale.value}px`);

function begin() {
  state.value = "loading";
  loadMs.value = null;
  startedAt = performance.now();
  clearTimeout(timer);
  timer = setTimeout(fail, props.timeout);
}
function fail() {
  clearTimeout(timer);
  if (state.value === "loaded") return;
  state.value = "failed";
  emit("error");
}
function loaded() {
  clearTimeout(timer);
  state.value = "loaded";
  loadMs.value = Math.round(performance.now() - startedAt);
  emit("load", loadMs.value);
}
function reload() {
  generation.value++;
  begin();
}

function onMessage(event: MessageEvent) {
  const target = frame.value?.contentWindow;
  if (!target || event.source !== target || event.origin !== expected.value) return;
  const message = props.parse ? props.parse(event.data) : (parsePreviewAction(event.data) as In | null);
  if (message) emit("message", message);
}

/** Sends a message to the page, which receives it only if its origin is the expected one. */
function post(message: Out) {
  frame.value?.contentWindow?.postMessage(message, expected.value === "null" ? "*" : expected.value);
}

let observer: ResizeObserver | undefined;
onMounted(() => {
  begin();
  window.addEventListener("message", onMessage);
  if (typeof ResizeObserver !== "undefined" && fit.value) {
    observer = new ResizeObserver(([entry]) => {
      if (entry) pane.value = { width: entry.contentRect.width, height: entry.contentRect.height };
    });
    observer.observe(fit.value);
  }
});
onBeforeUnmount(() => {
  window.removeEventListener("message", onMessage);
  observer?.disconnect();
  clearTimeout(timer);
});
watch(() => props.src, begin);

defineExpose({ reload, post });
</script>

<template>
  <div class="flex h-full min-h-0 min-w-0 flex-col" data-preview-frame :data-state="state">
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-border-separator px-4 py-2">
      <slot name="toolbar" />
      <div class="ml-auto flex items-center gap-2">
        <Tabs :model-value="props.device" :tabs="tabs" :label="t('core.preview.device')" @update:model-value="(value) => value && emit('update:device', value)" />
        <button type="button" data-preview-reload :aria-label="t('core.preview.reload')" :title="t('core.preview.reload')"
          class="hit-target flex size-8 cursor-pointer items-center justify-center rounded-button text-content-muted hover:bg-fill hover:text-content-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus" @click="reload">
          <Icon name="refreshLine" :size="16" />
        </button>
        <a :href="props.src" target="_blank" rel="noopener" data-preview-open :aria-label="t('core.preview.open')" :title="t('core.preview.open')"
          class="hit-target flex size-8 items-center justify-center rounded-button text-content-muted hover:bg-fill hover:text-content-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus">
          <Icon name="externalLink" :size="16" />
        </a>
      </div>
    </div>

    <div class="relative min-h-0 flex-1 bg-surface-page p-4">
      <div ref="fit" class="relative size-full">
        <div class="mx-auto h-full overflow-hidden rounded-md border border-border-separator bg-surface-cell shadow-sm" :style="{ width: boxWidth }">
          <iframe :key="generation" ref="frame" :src="props.src" :title="props.title" :sandbox="props.sandbox" :style="frameStyle" class="block border-0 bg-white"
            @load="loaded" @error="fail" />
        </div>
        <div v-if="state === 'loading'" role="status" class="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-footnote text-content-muted" data-preview-loading>
          <Icon name="loader4Line" :size="16" class="animate-spin motion-reduce:animate-none" />{{ t("core.preview.loading") }}
        </div>
        <div v-if="state === 'failed'" role="alert" class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-cell text-center" data-preview-failed>
          <p class="text-body text-status-danger-content">{{ t("core.preview.failed") }}</p>
          <button type="button" class="cursor-pointer rounded-button bg-fill px-3 py-1.5 text-footnote font-medium text-content-strong hover:bg-fill-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus" @click="reload">{{ t("core.preview.retry") }}</button>
        </div>
      </div>
    </div>

    <div class="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-separator px-4 py-1.5 text-footnote text-content-muted" data-preview-footer>
      <slot name="footer" :width="width" :scale="scale" :device="props.device" :load-ms="loadMs">
        <span v-if="loadMs !== null" class="tabular-nums">{{ t("core.preview.loaded_in", { ms: loadMs }) }}</span>
        <span>{{ scale < 1 ? t("core.preview.size_scaled", { width, percent: Math.round(scale * 100) }) : t("core.preview.size", { width }) }}</span>
      </slot>
    </div>
  </div>
</template>
