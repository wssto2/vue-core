<script setup lang="ts">
import { computed } from "vue";
import { Icon, type IconName } from "../icon";

/**
 * One line of guidance directly under a control or a small panel row, where a `Banner` is too
 * heavy. Give it an `id` and reference it from the control's `aria-describedby`.
 *
 *   <FieldNote tone="warning">Enter a price rule before publishing.</FieldNote>
 */
const props = withDefaults(defineProps<{
  tone?: "info" | "warning" | "critical";
  icon?: IconName;
}>(), { tone: "info", icon: undefined });

defineSlots<{ default?: () => unknown }>();

// Status roles, so the text keeps its certified contrast on the page and cell surfaces.
const TONES = {
  info: { text: "text-content-muted", icon: "informationLine" },
  warning: { text: "text-status-warning-content", icon: "alertTriangle" },
  critical: { text: "text-status-danger-content", icon: "errorWarningLine" },
} as const satisfies Record<string, { text: string; icon: IconName }>;

const tone = computed(() => TONES[props.tone]);
</script>

<template>
  <p class="mt-1 flex items-start gap-1.5 text-xs" :class="tone.text">
    <Icon :name="props.icon ?? tone.icon" :size="14" class="mt-px" />
    <span><slot /></span>
  </p>
</template>
