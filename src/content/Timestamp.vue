<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";

/**
 * A date or a date and time, formatted for the active locale, with the calendar icon. Nothing to
 * show (no value, or one that is not a date) reads "No data".
 *
 *   <Timestamp :value="lead.created_at" />
 *   <Timestamp :value="invoice.due" precision="date" />
 */
const props = withDefaults(defineProps<{
  value?: string | Date | null;
  precision?: "date" | "dateTime";
}>(), { value: undefined, precision: "dateTime" });

const { t, locale } = useI18n();

// A date without a time ("2026-09-30") is a calendar day, not an instant: read as UTC midnight it
// would show the day before in zones west of Greenwich.
const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const date = computed(() => {
  if (props.value === null || props.value === undefined || props.value === "") return null;
  if (props.value instanceof Date) return Number.isNaN(props.value.getTime()) ? null : props.value;
  const civil = CIVIL_DATE.exec(props.value);
  const parsed = civil ? new Date(Number(civil[1]), Number(civil[2]) - 1, Number(civil[3])) : new Date(props.value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
});

const isoValue = computed(() => {
  if (!date.value) return undefined;
  return typeof props.value === "string" && CIVIL_DATE.test(props.value) ? props.value : date.value.toISOString();
});

const text = computed(() =>
  date.value
    ? new Intl.DateTimeFormat(locale.value, props.precision === "date" ? { dateStyle: "medium" } : { dateStyle: "medium", timeStyle: "short" }).format(date.value)
    : null,
);
</script>

<template>
  <time v-if="date" :datetime="isoValue" class="inline-flex items-center gap-2 text-xs text-content">
    <Icon name="calendarEventFill" class="text-content-muted" />{{ text }}
  </time>
  <span v-else class="text-xs text-content-muted">{{ t("core.state.empty") }}</span>
</template>
