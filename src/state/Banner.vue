<script setup lang="ts">
import { computed } from "vue";
import { Icon, type IconName } from "../icon";
import type { Tone } from "./tone";

/**
 * A message about a panel or a page: information, a warning, a failure, a confirmation. One line
 * of guidance under a single field is a `FieldNote`. A critical banner is announced as an alert,
 * the others politely.
 *
 *   <Banner tone="warning">The price rule is missing.</Banner>
 *   <Banner tone="critical" icon="errorWarningLine"><p>…</p><Button …>Retry</Button></Banner>
 */
const props = withDefaults(defineProps<{
  tone?: Tone;
  /** Replaces the icon of the tone. */
  icon?: IconName;
  /** How it is announced; by default an alert for critical, a status for the others. */
  role?: "alert" | "status";
}>(), {
  tone: "neutral",
  icon: undefined,
  role: undefined,
});

defineSlots<{ default?: () => unknown }>();

// Written out in full so Tailwind generates every class.
const TONES = {
  neutral: { box: "bg-status-neutral-surface border-status-neutral-content/25", icon: "text-status-neutral-content", name: "informationLine" },
  info: { box: "bg-status-info-surface border-status-info-content/25", icon: "text-status-info-content", name: "informationLine" },
  positive: { box: "bg-status-success-surface border-status-success-content/25", icon: "text-status-success-content", name: "checkboxCircleFill" },
  warning: { box: "bg-status-warning-surface border-status-warning-content/25", icon: "text-status-warning-content", name: "alertTriangle" },
  critical: { box: "bg-status-danger-surface border-status-danger-content/25", icon: "text-status-danger-content", name: "errorWarningLine" },
} as const satisfies Record<Tone, { box: string; icon: string; name: IconName }>;

const tone = computed(() => TONES[props.tone]);
</script>

<template>
  <div class="rounded-lg border px-4 py-3 text-content-strong" :class="tone.box" :role="props.role ?? (props.tone === 'critical' ? 'alert' : 'status')">
    <div class="flex items-center gap-3">
      <Icon :name="props.icon ?? tone.name" :class="tone.icon" />
      <!-- min-w-0: long words and enlarged text wrap instead of widening the banner. -->
      <div class="min-w-0 flex-1 break-words">
        <slot />
      </div>
    </div>
  </div>
</template>
