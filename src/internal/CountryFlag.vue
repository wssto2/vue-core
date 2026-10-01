<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from "vue";
import { flagLoaders } from "./flagLoaders";

/**
 * The flag of a country (ISO 3166-1 alpha-2, upper case) as an SVG (Windows draws the emoji flags as two letters). Each flag is
 * its own lazy module, loaded when the flag first scrolls into view, so an app downloads the flags a screen shows and not the 250
 * of the package. Shared by the phone field and the shell's language menu; knows nothing of phone numbers.
 */
const props = defineProps<{ country: string }>();

const holder = useTemplateRef<HTMLElement>("holder");
const source = shallowRef<string | null>(null);
const near = ref(typeof IntersectionObserver === "undefined");
let observer: IntersectionObserver | null = null;

async function load(country: string) {
  const loader = flagLoaders[country];
  if (!loader) return void (source.value = null);
  const { default: svg } = await loader();
  if (country === props.country) source.value = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

onMounted(() => {
  if (near.value || !holder.value) return;
  observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      near.value = true;
      observer?.disconnect();
    }
  });
  observer.observe(holder.value);
});
onBeforeUnmount(() => observer?.disconnect());
watch([() => props.country, near], ([country, visible]) => {
  source.value = null;
  if (visible) void load(country);
}, { immediate: true });
</script>

<template>
  <span ref="holder" class="inline-block h-3.5 w-5 shrink-0 overflow-hidden rounded-xs bg-fill-strong ring-1 ring-border-separator" data-test="flag" :data-country="props.country">
    <img v-if="source" :src="source" alt="" class="size-full object-cover" draggable="false" />
  </span>
</template>
