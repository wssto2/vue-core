<script setup lang="ts">
import { ref, watchEffect } from "vue";
import { version } from "@wssto2/vue-core";
import Showcase from "./Showcase.vue";

const accent = ref<"emerald" | "violet">("emerald");
const dark = ref(false);

watchEffect(() => {
  document.documentElement.dataset.accent = accent.value;
  document.documentElement.classList.toggle("dark", dark.value);
});
</script>

<template>
  <main class="mx-auto flex max-w-content flex-col gap-section-gap p-screen-padding">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-large-title font-semibold text-content-strong">vue-core playground</h1>
        <p class="text-subheadline text-content-muted">
          Installed from the packed tarball, version <code class="font-mono">{{ version }}</code>
        </p>
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          class="hit-target rounded-button bg-tint-soft px-3 py-1.5 text-subheadline font-medium text-content-link"
          @click="accent = accent === 'emerald' ? 'violet' : 'emerald'"
        >
          Accent: {{ accent }}
        </button>
        <button
          type="button"
          class="hit-target rounded-button bg-fill px-3 py-1.5 text-subheadline font-medium text-content-strong"
          @click="dark = !dark"
        >
          {{ dark ? "Dark" : "Light" }}
        </button>
      </div>
    </header>

    <section class="overflow-hidden rounded-group bg-surface-cell shadow-group">
      <div class="flex min-h-row items-center gap-3 px-row-inset">
        <span class="grid size-tile place-items-center rounded-md bg-tile-brand text-tile-brand-foreground">A</span>
        <span class="text-body text-content-strong">Brand tile</span>
      </div>
      <div class="flex min-h-row items-center gap-3 border-t border-border-separator px-row-inset">
        <span class="grid size-tile place-items-center rounded-md bg-tile-anchor text-tile-anchor-foreground">B</span>
        <span class="text-body text-content-strong">Anchor tile</span>
      </div>
      <div class="flex min-h-row items-center justify-between border-t border-border-separator px-row-inset">
        <span class="text-body text-content-strong">Focusable link</span>
        <a href="#focus" class="text-body text-content-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus">Open</a>
      </div>
    </section>

    <section class="flex flex-wrap gap-2">
      <button type="button" class="hit-target rounded-button bg-tint px-4 py-2 text-body font-medium text-content-on-tint">Primary</button>
      <span class="rounded-md bg-status-success-surface px-2 py-0.5 text-footnote text-status-success-content">Success</span>
      <span class="rounded-md bg-status-warning-surface px-2 py-0.5 text-footnote text-status-warning-content">Warning</span>
      <span class="rounded-md bg-status-danger-surface px-2 py-0.5 text-footnote text-status-danger-content">Danger</span>
      <span class="rounded-md bg-status-info-surface px-2 py-0.5 text-footnote text-status-info-content">Info</span>
    </section>

    <Showcase />

    <p class="text-footnote text-content-muted">
      Status colours stay fixed when the accent changes; the prebuilt stylesheet is checked in
      <a class="text-content-link" href="./prebuilt.html">prebuilt.html</a>.
    </p>
  </main>
</template>
