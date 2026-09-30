<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from "vue";
import { useBottomDockTarget } from "./bottomDock";

/**
 * The bottom dock: everything pinned to the bottom edge (a form's error bar, a page's action bar,
 * the record tab bar on touch layouts) renders here, stacked, through `BottomDockPortal`. The app
 * installs the context once (`installBottomDock`) and mounts one dock at its root, beside the pages.
 * The dock publishes its height as `--bottom-dock-h` on `<html>`, so pages
 * pad for it and toasts sit above it, and nothing hides behind it. Classes (a left offset beside a
 * sidebar) go on it like on any element.
 *
 *   <BottomDock class="md:left-64" />
 */
const dock = useTemplateRef<HTMLElement>("dock");
const target = useBottomDockTarget();

let observers: Array<{ disconnect(): void }> = [];

function measure() {
  document.documentElement.style.setProperty("--bottom-dock-h", `${Math.round(dock.value?.getBoundingClientRect().height ?? 0)}px`);
}

onMounted(() => {
  target.value = dock.value;
  measure();
  if (!dock.value) return;
  // Resize notifications are tied to rendered frames (a background tab gets none), so bars
  // arriving or leaving also re-measure directly: getBoundingClientRect lays out synchronously.
  if (typeof ResizeObserver !== "undefined") {
    const resize = new ResizeObserver(measure);
    resize.observe(dock.value);
    observers.push(resize);
  }
  const mutation = new MutationObserver(measure);
  mutation.observe(dock.value, { childList: true, subtree: true });
  observers.push(mutation);
});

onBeforeUnmount(() => {
  target.value = null;
  observers.forEach((observer) => observer.disconnect());
  observers = [];
  document.documentElement.style.removeProperty("--bottom-dock-h");
});
</script>

<template>
  <div ref="dock" data-bottom-dock class="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col"></div>
</template>
