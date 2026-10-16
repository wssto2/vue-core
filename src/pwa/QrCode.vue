<script setup lang="ts">
import { computed } from "vue";
import { encode } from "uqr";

/**
 * A QR code of `value` (typically the application's own address, to open it on a phone), drawn as
 * one SVG path from `uqr`'s module matrix: dark modules on a white quiet zone in either theme, as
 * cameras read it. `label` is the accessible name.
 *
 *   <QrCode :value="origin" :size="184" label="QR code of the address" />
 */
const props = withDefaults(defineProps<{ value: string; size?: number; label: string }>(), { size: 132 });

const QUIET = 2;

const qr = computed(() => encode(props.value, { ecc: "M", border: 0 }));
const extent = computed(() => qr.value.size + QUIET * 2);
const path = computed(() => {
  let d = "";
  qr.value.data.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) d += `M${x + QUIET} ${y + QUIET}h1v1h-1z`;
  }));
  return d;
});
</script>

<template>
  <svg :width="size" :height="size" :viewBox="`0 0 ${extent} ${extent}`" role="img" :aria-label="label" shape-rendering="crispEdges"
    class="shrink-0 rounded-lg bg-white" data-test="install-qr">
    <path :d="path" fill="#0D1714" />
  </svg>
</template>
