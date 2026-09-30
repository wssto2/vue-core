<script setup lang="ts" generic="Row extends object">
import { computed } from "vue";
import type { RouteLocationRaw } from "vue-router";
import { useFormat } from "../format";
import { Badge } from "../state";
import { Timestamp } from "../content";
import RecordIdentity from "./RecordIdentity.vue";
import { valueAt, type Column, type ColumnKey } from "./columns";

/**
 * The standard rendering of a cell, by the column's `kind`. A list renders it when the page gave no
 * `#cell-<key>` slot for the column: identity, text, timestamp, number, money and badge are the
 * cells ARV's lists repeat; `custom` is for what they do not cover.
 */
const props = defineProps<{
  column: Column<Row>;
  item: Row;
  compact: boolean;
  /** The record's link, carrying the list's state. */
  to: RouteLocationRaw | null;
}>();

defineSlots<{
  /** A mark before the identity (an avatar, a tile): the phone row shows it in its own column instead. */
  leading?: () => unknown;
}>();

const format = useFormat();
const value = computed(() => valueAt(props.item, props.column.key as ColumnKey<Row>));
const when = computed(() => value.value as string | Date | null | undefined);
const text = computed(() => (value.value === null || value.value === undefined ? "" : String(value.value)));
const asNumber = computed(() => (typeof value.value === "number" ? value.value : typeof value.value === "string" && value.value.trim() !== "" ? Number(value.value) : null));
</script>

<template>
  <template v-if="props.column.kind === 'identity'">
    <div v-if="!props.compact && $slots.leading" class="flex items-center gap-3">
      <slot name="leading" />
      <RecordIdentity :to="props.to" :title="props.column.title?.(props.item) ?? text" :subtitle="props.column.subtitle?.(props.item)" subtitle-selectable />
    </div>
    <RecordIdentity v-else :to="props.to" :title="props.column.title?.(props.item) ?? text" :subtitle="props.column.subtitle?.(props.item)" subtitle-selectable />
  </template>

  <template v-else-if="props.column.kind === 'timestamp'">
    <time v-if="props.compact && when" class="tabular-nums" :datetime="String(value)">
      {{ props.column.precision === "date" ? format.date(when) : format.dateTime(when) }}
    </time>
    <Timestamp v-else-if="!props.compact" :value="when" :precision="props.column.precision ?? 'dateTime'" />
  </template>

  <span v-else-if="props.column.kind === 'number'" class="tabular-nums">{{ format.number(asNumber, props.column.format) }}</span>

  <span v-else-if="props.column.kind === 'money'" class="tabular-nums">
    {{ format.money(asNumber, typeof props.column.currency === "function" ? props.column.currency(props.item) : props.column.currency) }}
  </span>

  <Badge v-else-if="props.column.kind === 'badge'" :tone="props.column.tone(props.item)" dot>{{ props.column.text?.(props.item) ?? text }}</Badge>

  <template v-else>{{ text }}</template>
</template>
