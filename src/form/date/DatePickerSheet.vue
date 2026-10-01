<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { useFormat } from "../../format";
import Sheet from "../../modal/Sheet.vue";
import Calendar from "./Calendar.vue";
import { isDay, parseDay, today, type Day, type DisabledDates } from "./days";
import QuickChips from "./QuickChips.vue";
import type { Shortcut } from "./quickPicks";
import { joinDateTime, splitDateTime, timeNow, type Time } from "./time";
import TimeColumns from "./TimeColumns.vue";

/**
 * What a date, a date and time, or a time field opens on a phone: a half sheet with the quick picks, the calendar and the
 * hour and minute wheels. It edits a draft: Done puts it in the field, Clear empties the field, and dismissing the sheet
 * (swipe, backdrop, Escape) leaves the field as it was. The value is `"2026-09-30"`, `"2026-09-30T14:35"` or `"14:35"`
 * by `mode`.
 */
const props = withDefaults(
  defineProps<{
    title: string;
    mode: "date" | "datetime" | "time";
    modelValue?: string | null;
    min?: Day | null;
    max?: Day | null;
    disabledDates?: DisabledDates;
    openOn?: Day | null;
    shortcuts?: readonly (Shortcut & { disabled?: boolean })[];
    /** The minute wheel's step. */
    step?: number;
    clearable?: boolean;
  }>(),
  { modelValue: null, min: null, max: null, disabledDates: undefined, openOn: null, shortcuts: () => [], step: 1, clearable: true },
);
const emit = defineEmits<{ "update:modelValue": [value: string | null] }>();

const { t } = useI18n();
const format = useFormat();
const sheet = useTemplateRef<InstanceType<typeof Sheet>>("sheet");

const hasDay = computed(() => props.mode !== "time");
const hasTime = computed(() => props.mode !== "date");
const day = ref<Day | null>(null);
const time = ref<Time | null>(null);

function present() {
  const parts = props.mode === "time" ? { day: null, time: props.modelValue } : props.mode === "date" ? { day: props.modelValue, time: null } : splitDateTime(props.modelValue);
  day.value = isDay(parts.day) ? parts.day : null;
  time.value = hasTime.value ? (parts.time ?? timeNow(props.step)) : null;
  sheet.value?.present();
}

function value(): string | null {
  if (props.mode === "time") return time.value;
  if (!day.value) return null;
  return props.mode === "date" ? day.value : joinDateTime(day.value, time.value ?? timeNow(props.step));
}

function done() {
  emit("update:modelValue", value());
  sheet.value?.dismiss();
}

function clear() {
  emit("update:modelValue", null);
  sheet.value?.dismiss();
}

function pickShortcut(value: string) {
  if (props.mode === "time") time.value = value;
  else day.value = value;
}

/** Turning a wheel on a date and time with no day yet takes today. */
function turnWheel(next: Time | null) {
  time.value = next;
  if (hasDay.value && !day.value) day.value = today();
}

const summary = computed(() => {
  const long = (value: Day) => {
    const civil = parseDay(value)!;
    const text = new Intl.DateTimeFormat(format.locale, { dateStyle: "full", timeZone: "UTC" }).format(new Date(Date.UTC(civil.year, civil.month - 1, civil.day)));
    return text.charAt(0).toLocaleUpperCase(format.locale) + text.slice(1);
  };
  if (props.mode === "time") return time.value ?? "";
  if (!day.value) return "";
  return props.mode === "date" || !time.value ? long(day.value) : t("core.form.time.at", { date: long(day.value), time: time.value });
});

defineExpose({ present, dismiss: () => sheet.value?.dismiss() });
</script>

<template>
  <Sheet ref="sheet" :title="props.title" grouped>
    <template #header="{ titleId }">
      <div class="flex min-h-bar-height items-center gap-2 px-4 pb-1">
        <button type="button" :disabled="!props.clearable" class="min-w-16 cursor-pointer py-1.5 text-start text-headline text-content-link focus-visible:outline-2 focus-visible:outline-border-focus disabled:cursor-default disabled:text-content-disabled" @click="clear">
          {{ t("core.form.select.clear") }}
        </button>
        <h3 :id="titleId" class="min-w-0 grow truncate text-center text-headline font-semibold">{{ props.title }}</h3>
        <button type="button" class="min-w-16 cursor-pointer py-1.5 text-end text-headline font-semibold text-content-link focus-visible:outline-2 focus-visible:outline-border-focus" @click="done">
          {{ t("core.form.select.done") }}
        </button>
      </div>
    </template>

    <div class="flex flex-col gap-3.5" data-test="date-picker-sheet">
      <QuickChips v-if="props.shortcuts.length > 0" variant="sheet" :items="props.shortcuts" :selected="props.mode === 'time' ? time : day" @pick="pickShortcut" />

      <div v-if="hasDay" class="rounded-group bg-surface-cell p-2.5 shadow-group">
        <Calendar v-model="day" size="touch" :min="props.min" :max="props.max" :disabled-dates="props.disabledDates" :open-on="props.openOn" />
      </div>

      <div v-if="hasTime" class="flex items-center gap-2 rounded-group bg-surface-cell px-4 py-2 shadow-group">
        <p v-if="hasDay" class="w-22 shrink-0 text-body">{{ t("core.form.time.label") }}</p>
        <div class="flex grow justify-center">
          <TimeColumns :model-value="time" variant="wheel" :step="props.step" @update:model-value="turnWheel" />
        </div>
      </div>

      <p class="min-h-5 text-center text-subheadline text-content-muted" aria-live="polite">{{ summary }}</p>
    </div>
  </Sheet>
</template>
