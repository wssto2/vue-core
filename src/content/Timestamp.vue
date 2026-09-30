<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { toDate, useFormat } from "../format";
import { Icon } from "../icon";

// A date without a time keeps its own text in `datetime`: an instant would move it across zones.
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A date or a date and time, formatted by the app's formatting (`useFormat`, numeric by default),
 * with the calendar icon. Nothing to show (no value, one that is not a date, or an unset one: Go's
 * zero time, the epoch) reads "No data".
 *
 *   <Timestamp :value="lead.created_at" />
 *   <Timestamp :value="invoice.due" precision="date" />
 */
const props = withDefaults(defineProps<{
  value?: string | Date | null;
  precision?: "date" | "dateTime";
}>(), { value: undefined, precision: "dateTime" });

const { t } = useI18n();
const format = useFormat();

const date = computed(() => toDate(props.value));

const isoValue = computed(() => {
  if (!date.value) return undefined;
  return typeof props.value === "string" && CIVIL_DATE.test(props.value) ? props.value : date.value.toISOString();
});

const text = computed(() => (props.precision === "date" ? format.date(date.value) : format.dateTime(date.value)));
</script>

<template>
  <time v-if="date" :datetime="isoValue" class="inline-flex items-center gap-2 text-xs text-content">
    <Icon name="calendarEventFill" class="text-content-muted" />{{ text }}
  </time>
  <span v-else class="text-xs text-content-muted">{{ t("core.state.empty") }}</span>
</template>
