<script setup lang="ts">
import { useTemplateRef } from "vue";

/**
 * A bare search field for a palette or a sheet's own search bar: large text, no surface of its
 * own (the container draws it). Other attributes (ARIA combobox wiring) pass through to the input.
 *
 *   <SearchInput v-model="query" :label="t('search')" :placeholder="t('search.hint')" />
 */
defineOptions({ inheritAttrs: false });

const model = defineModel<string>({ required: true });
const props = defineProps<{
  /** The accessible name; a placeholder is never the only label. */
  label: string;
  placeholder?: string;
}>();

const input = useTemplateRef<HTMLInputElement>("input");
defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
  <input ref="input" v-model="model" type="search" enterkeyhint="search" autocomplete="off" spellcheck="false"
    :aria-label="props.label" :placeholder="props.placeholder" v-bind="$attrs"
    class="min-w-0 flex-1 bg-transparent text-title outline-none placeholder:text-content-disabled [&::-webkit-search-cancel-button]:hidden" />
</template>
