<script setup lang="ts">
import { computed } from "vue";
import { useFormat } from "../format";

const format = useFormat();

/**
 * An outcome as one grouped card of numbers: a quiet label over a large tabular value per cell, hairlines between cells, an optional
 * share bar under a value, and optional header and footer rows (a run's date and status, a success-rate bar).
 *
 *   <StatSummary :items="[{ key: 'total', label: 'Rows', value: 120 },
 *                         { key: 'failed', label: 'Errors', value: 9, tone: 'danger', share: 7.5 }]">
 *     <template #footer>…</template>
 *   </StatSummary>
 *
 * Wide screens show every cell in one row; compact screens wrap into `compactColumns` and drop cells marked `compact: false`.
 */
export type StatTone = "neutral" | "muted" | "info" | "success" | "warning" | "danger";

export type StatItem = {
  key: string;
  label: string;
  value: number;
  tone?: StatTone;
  /** 0–100: draws a share bar with the percentage under the value. */
  share?: number | null;
  /** False hides the cell on compact screens (secondary numbers). */
  compact?: boolean;
};

const props = withDefaults(defineProps<{
  items: StatItem[];
  compactColumns?: number;
}>(), { compactColumns: 2 });

defineSlots<{ header?: () => unknown; footer?: () => unknown }>();

// Written out in full so Tailwind generates every class.
const VALUE: Record<StatTone, string> = {
  neutral: "text-content-strong",
  muted: "text-content-muted",
  info: "text-status-info-content",
  success: "text-status-success-content",
  warning: "text-status-warning-content",
  danger: "text-status-danger-content",
};
const BAR: Record<StatTone, string> = {
  neutral: "bg-content-muted",
  muted: "bg-content-disabled",
  info: "bg-status-info-content",
  success: "bg-status-success-content",
  warning: "bg-status-warning-content",
  danger: "bg-status-danger-content",
};

const clamp = (share: number) => Math.min(100, Math.max(0, share));
const style = computed(() => ({
  "--stat-columns": String(props.items.length),
  "--stat-compact-columns": String(props.compactColumns),
}));
</script>

<template>
  <section data-test="stat-summary" class="overflow-hidden rounded-group bg-surface-cell shadow-group" :style="style">
    <div v-if="$slots.header" class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-separator px-row-inset py-2.5 text-subheadline">
      <slot name="header" />
    </div>
    <dl class="-mt-px -ml-px grid grid-cols-[repeat(var(--stat-columns),minmax(0,1fr))] compact:grid-cols-[repeat(var(--stat-compact-columns),minmax(0,1fr))]">
      <div v-for="item in props.items" :key="item.key" :data-stat="item.key"
        class="flex min-w-0 flex-col gap-1.5 border-t border-l border-border-separator px-row-inset py-3"
        :class="item.compact === false ? 'compact:hidden' : ''">
        <dt class="truncate text-footnote text-content-muted">{{ item.label }}</dt>
        <dd class="text-title leading-none font-semibold tracking-tight tabular-nums" :class="VALUE[item.tone ?? 'neutral']">
          {{ format.number(item.value, { maximumFractionDigits: 0 }) }}
        </dd>
        <dd v-if="item.share != null" class="flex items-center gap-2">
          <span class="h-1 flex-1 overflow-hidden rounded-full bg-fill">
            <span class="block h-full rounded-full" :class="BAR[item.tone ?? 'neutral']" :style="{ width: `${clamp(item.share)}%` }" />
          </span>
          <span class="text-caption tabular-nums text-content-muted">{{ Math.round(clamp(item.share)) }} %</span>
        </dd>
      </div>
    </dl>
    <div v-if="$slots.footer" class="flex min-w-0 items-center gap-3 border-t border-border-separator px-row-inset py-2.5 text-subheadline">
      <slot name="footer" />
    </div>
  </section>
</template>
