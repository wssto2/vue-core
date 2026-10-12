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
 * avatar and the name, then the date in muted text, as a mail list shows sender and date. A long
 * name truncates; the date never does.
 *
 *   <Timestamp :value="lead.created_at" />
 *   <Timestamp :value="invoice.due" precision="date" />
 *   <Timestamp :value="lead.updated_at" :author="{ name: lead.updated_by }" />
 */
const props = withDefaults(defineProps<{
  value?: string | Date | null;
  precision?: "date" | "dateTime";
  /**
   * Who changed it. `avatar` (a photo reference) is accepted for the record's author as the API
   * returns it, but the avatar shows initials only until `Avatar` can show photos.
   */
  author?: { name: string; avatar?: string | null } | null;
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
  <span v-if="date && props.author" class="inline-flex max-w-full min-w-0 items-center gap-2 text-xs" data-timestamp-author>
    <Avatar :name="props.author.name" size="xs" />
    <span class="min-w-0 truncate text-content">{{ props.author.name }}</span>
    <time :datetime="isoValue" class="shrink-0 text-content-muted">{{ text }}</time>
  </span>
  <time v-else-if="date" :datetime="isoValue" class="inline-flex items-center gap-2 text-xs text-content">
    <Icon name="calendarEventFill" class="text-content-muted" />{{ text }}
  </time>
  <span v-else class="text-xs text-content-muted">{{ t("core.state.empty") }}</span>
</template>
