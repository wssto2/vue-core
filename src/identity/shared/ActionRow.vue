<script setup lang="ts">
import { FormRow } from "../../form";
import { Icon } from "../../icon";

/**
 * A row of a grouped list that does something when it is pressed: its label in the action's colour (link for a routine
 * one, red for a consequential one), the line saying what it does under it, and a chevron. A button, so the keyboard reaches it.
 */
const props = withDefaults(defineProps<{
  label: string;
  sub?: string;
  tone?: "link" | "critical";
  disabled?: boolean;
}>(), { sub: undefined, tone: "link", disabled: false });

const emit = defineEmits<{ click: [] }>();
</script>

<template>
  <FormRow layout="stacked">
    <button type="button" :disabled="props.disabled"
      class="flex w-full items-center gap-3 py-0.5 text-left focus-visible:outline-2 focus-visible:outline-border-focus disabled:opacity-50"
      @click="emit('click')">
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="text-body" :class="props.tone === 'critical' ? 'text-content-destructive' : 'text-content-link'">{{ props.label }}</span>
        <span v-if="props.sub" class="text-footnote text-content-muted">{{ props.sub }}</span>
      </span>
      <Icon name="arrowRightSLine" :size="18" class="shrink-0 text-content-disabled" />
    </button>
  </FormRow>
</template>
