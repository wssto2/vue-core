<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { toDate, useFormat } from "../format";
import { Icon } from "../icon";
import Avatar from "./Avatar.vue";

// A date without a time keeps its own text in `datetime`: an instant would move it across zones.
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A date or a date and time, formatted by the app's formatting (`useFormat`, numeric by default),
 * with the calendar icon. Nothing to show (no value, one that is not a date, or an unset one: Go's
 * zero time, the epoch) reads "No data".
 *
 * With an `author` (who changed the record) the calendar icon gives way to the person: a small
 * avatar, centred on two lines, the name on the first (a long one truncates) and the date on the
 * second in muted text (never truncated, never wrapped). The cell is as wide as the wider of the
 * two, so a list column stays narrow. One layout; there is no option for the inline one.
 *
 *   <Timestamp :value="lead.created_at" />
 *   <Timestamp :value="invoice.due" precision="date" />
 *   <Timestamp :value="lead.updated_at" :author="{ name: lead.updated_by }" />
 */
const props = withDefaults(defineProps<{
  value?: string | Date | null;
  precision?: "date" | "dateTime";
  /** Who changed it. `avatarUrl` is the photo's full URL, built by the app; initials show until it loads or without it. */
  author?: { name: string; avatarUrl?: string | null } | null;
}>(), { value: undefined, precision: "dateTime", author: null });

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
  <span v-if="date && props.author" class="inline-grid max-w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 text-xs" data-timestamp-author>
    <Avatar :name="props.author.name" :src="props.author.avatarUrl" size="xs" class="row-span-2" />
    <span class="min-w-0 truncate text-content">{{ props.author.name }}</span>
    <time :datetime="isoValue" class="whitespace-nowrap text-content-muted">{{ text }}</time>
  </span>
  <time v-else-if="date" :datetime="isoValue" class="inline-flex items-center gap-2 text-xs text-content">
    <Icon name="calendarEventFill" class="text-content-muted" />{{ text }}
  </time>
  <span v-else class="text-xs text-content-muted">{{ t("core.state.empty") }}</span>
</template>
