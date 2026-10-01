<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { Shortcut } from "./quickPicks";

/** A row of shortcut chips (Today, Tomorrow, …); the one whose value is the current one is tinted. A chip that is not allowed is disabled. */
const props = withDefaults(defineProps<{ items: readonly (Shortcut & { disabled?: boolean })[]; selected?: string | null; variant?: "popover" | "sheet" }>(), { selected: null, variant: "popover" });
const emit = defineEmits<{ pick: [value: string] }>();
const { t } = useI18n();
</script>

<template>
  <div role="group" :aria-label="t('core.form.date.quick')" class="flex flex-wrap gap-1.5" data-test="quick-picks">
    <button v-for="item in props.items" :key="item.key" type="button" :disabled="item.disabled" :aria-pressed="item.value === props.selected"
      class="cursor-pointer whitespace-nowrap rounded-full font-medium transition-colors duration-motion-fast focus-visible:outline-2 focus-visible:outline-border-focus disabled:cursor-default disabled:opacity-45"
      :class="[
        props.variant === 'sheet' ? 'px-3 py-2 text-subheadline' : 'px-2.5 py-1.5 text-footnote',
        item.value === props.selected
          ? props.variant === 'sheet' ? 'bg-tint text-content-on-tint' : 'bg-tint-soft text-content-link'
          : props.variant === 'sheet' ? 'bg-surface-cell text-content-strong shadow-group' : 'bg-fill text-content-strong hover:bg-fill-strong',
      ]"
      @click="emit('pick', item.value)">
      {{ item.label }}
    </button>
  </div>
</template>
