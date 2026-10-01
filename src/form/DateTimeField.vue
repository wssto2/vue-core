<script setup lang="ts">
import { computed, nextTick, useId, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import DateButton from "../controls/DateButton.vue";
import { useFormat } from "../format";
import { Icon } from "../icon";
import { useCompactPresentation } from "../internal/mediaQuery";
import Popover from "../overlay/Popover.vue";
import { useControlSurface } from "./control";
import Calendar from "./date/Calendar.vue";
import DatePickerSheet from "./date/DatePickerSheet.vue";
import { isDay, isDayDisabled, today, type Day, type DayRules, type DisabledDates } from "./date/days";
import { splitTypedDateTime } from "./date/parse";
import QuickChips from "./date/QuickChips.vue";
import type { QuickPick } from "./date/quickPicks";
import { isTime, joinDateTime, splitDateTime, timeNow } from "./date/time";
import TimeColumns from "./date/TimeColumns.vue";
import { useDateText } from "./date/useDateText";
import { useDayShortcuts } from "./date/useShortcuts";
import { useTimeText } from "./date/useTimeText";
import { useTypedEntry } from "./date/useTypedEntry";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, type FieldProps } from "./field";

/**
 * A calendar day and a time on the clock of the user, without a zone: `"2026-09-30T14:35"`, or `null`; turning this
 * wall-clock time into an instant (or back) is the feature's mapping. Typing is the main way in (`15.10.2026. 14:35`,
 * `danas 14.35`, `+7 9:00`, or only a time); the popover has the calendar beside an hour list and a minute list with every
 * minute (or every `minuteStep`th), and a phone gets a half sheet with drum wheels.
 *
 *   <DateTimeField v-bind="form.bind('visitAt')" :label="t('visitAt')" min="2026-10-01T08:00" />
 *   <DateTimeField v-bind="form.bind('slot')" :label="t('slot')" :minute-step="15" />
 *
 * `min` and `max` are days or date-times (a day alone means its whole day); `disabledDates` days apply to the date part.
 * A date typed without a time keeps the value's time (or takes the time now). The popover offers no day shortcuts unless
 * `quickPicks` says so; a phone's sheet has Today, Tomorrow and Next working day.
 */
const props = withDefaults(
  defineProps<
    FieldProps & {
      min?: string;
      max?: string;
      disabledDates?: DisabledDates;
      openOn?: Day;
      minuteStep?: number;
      quickPicks?: readonly QuickPick[];
    }
  >(),
  { ...fieldDefaults, min: undefined, max: undefined, disabledDates: undefined, openOn: undefined, minuteStep: 1, quickPicks: undefined },
);

const model = defineModel<string | null>({ default: null });
const { t } = useI18n();
const format = useFormat();
const compact = useCompactPresentation();
const input = useTemplateRef<HTMLInputElement>("input");
const popover = useTemplateRef<InstanceType<typeof Popover>>("popover");
const calendar = useTemplateRef<InstanceType<typeof Calendar>>("calendar");
const sheet = useTemplateRef<InstanceType<typeof DatePickerSheet>>("sheet");

const rules = computed<DayRules>(() => ({ min: props.min?.slice(0, 10), max: props.max?.slice(0, 10), disabled: props.disabledDates }));
const minimum = computed(() => (props.min && props.min.length === 10 ? `${props.min}T00:00` : props.min));
const maximum = computed(() => (props.max && props.max.length === 10 ? `${props.max}T23:59` : props.max));
const allowed = (value: string, day: Day) => !isDayDisabled(day, { disabled: props.disabledDates }) && (!minimum.value || value >= minimum.value) && (!maximum.value || value <= maximum.value);

const dates = useDateText(() => rules.value);
const times = useTimeText(() => props.minuteStep);
const current = computed(() => splitDateTime(model.value));

/** The value of a typed date and time: what is typed, and what is missing from what the value already is (or now). */
function parse(typed: string): { value: string } | { error: string } {
  const { date, time } = splitTypedDateTime(typed);
  const day = date === null ? (current.value.day ?? today()) : dates.parse(date);
  if (!day) return { error: dates.invalidMessage() };
  let clock = current.value.time ?? timeNow(props.minuteStep);
  if (time !== null) {
    const result = times.parse(time);
    if ("error" in result) return result;
    clock = result.value;
  }
  const value = joinDateTime(day, clock);
  return allowed(value, day) ? { value } : { error: dates.unavailableMessage() };
}

const entry = useTypedEntry({ model, display: (value) => `${format.date(splitDateTime(value).day)} ${splitDateTime(value).time ?? ""}`.trim(), parse });
// The time box inside the popover edits only the time of the value.
const clock = computed({
  get: () => current.value.time,
  set: (time) => {
    if (time && isTime(time)) model.value = joinDateTime(current.value.day ?? today(), time);
  },
});
const clockEntry = useTypedEntry({ model: clock, display: (value) => value, parse: times.parse });
const shortcuts = useDayShortcuts(() => props.quickPicks ?? (compact.value ? undefined : []), () => compact.value, () => rules.value);

const shownError = computed(() => props.error || entry.message.value || clockEntry.message.value);
const shown = computed(() => (model.value ? format.dateTime(model.value) : null));
const surface = useControlSurface("date", () => (shownError.value ? "error" : props.disabled ? "locked" : "rest"));
const typedDay = computed(() => {
  const value = entry.typed.value;
  return value ? (splitDateTime(value).day ?? null) : null;
});
const calendarDay = computed(() => typedDay.value ?? (isDay(current.value.day) ? current.value.day : null));
const clockValue = computed(() => (entry.typed.value ? splitDateTime(entry.typed.value).time : current.value.time));

function pickDay(day: string | null) {
  if (day) entry.set(joinDateTime(day, current.value.time ?? timeNow(props.minuteStep)));
}
function pickTime(time: string | null) {
  if (time) entry.set(joinDateTime(current.value.day ?? today(), time));
}
function now(dismiss: () => void) {
  entry.set(joinDateTime(today(), timeNow(props.minuteStep)));
  dismiss();
}

const clockId = useId();
async function open(intoCalendar: boolean) {
  if (props.disabled) return;
  popover.value?.present();
  if (!intoCalendar) return;
  await nextTick();
  await nextTick();
  calendar.value?.focus();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    entry.commit();
    popover.value?.dismiss();
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    void open(true);
  }
}

defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
  <Field v-slot="{ id, describedby, invalid }" v-bind="{ ...fieldProps(props), error: shownError }" :value="shown" value-style="numeric">
    <template v-if="compact">
      <DateButton v-bind="{ id, 'aria-describedby': describedby }" :disabled="props.disabled" :invalid="invalid" :placeholder="t('core.form.select.choose')" @click="sheet?.present()">
        <template v-if="model">{{ entry.text.value }}</template>
      </DateButton>
      <DatePickerSheet ref="sheet" :title="props.label ?? t('core.form.date.calendar')" mode="datetime" :model-value="model" :min="rules.min" :max="rules.max" :disabled-dates="props.disabledDates"
        :open-on="props.openOn" :shortcuts="shortcuts" :step="props.minuteStep" :clearable="!props.required" @update:model-value="entry.set" />
    </template>

    <Popover v-else ref="popover" :label="props.label ?? t('core.form.date.calendar')" width="auto" placement="bottom-start" :arrow="false" :autofocus="false">
      <template #trigger="{ attrs, presented }">
        <div class="inline-flex max-w-full items-center gap-2" :class="surface">
          <input :id="id" ref="input" v-bind="attrs" type="text" role="combobox" autocomplete="off" size="20" :name="props.name" :value="entry.text.value" :placeholder="dates.placeholder.value"
            :disabled="props.disabled" :required="props.required" :aria-required="props.required || undefined" :aria-invalid="invalid || undefined" :aria-describedby="describedby"
            class="block min-h-7 min-w-0 border-0 bg-transparent py-1 pl-2.5 text-body tabular-nums text-content-strong placeholder:text-content-disabled focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
            @input="entry.input(($event.target as HTMLInputElement).value)" @blur="entry.commit()" @keydown="onKeydown" @click="open(false)" />
          <button v-if="!props.disabled" type="button" tabindex="-1" :aria-label="t('core.form.date.open')" class="mr-2 flex shrink-0 cursor-pointer items-center text-content-link" @click="presented ? popover?.dismiss() : open(true)">
            <Icon name="calendarLine" :size="18" />
          </button>
        </div>
      </template>

      <template #default="{ dismiss }">
        <div class="-m-3 flex" data-test="date-time-popover">
          <div class="flex w-75 flex-col gap-2.5 border-r border-border-separator p-3.5">
            <Calendar ref="calendar" :model-value="calendarDay" :min="rules.min" :max="rules.max" :disabled-dates="props.disabledDates" :open-on="props.openOn" @update:model-value="pickDay" />
            <div v-if="shortcuts.length > 0" class="border-t border-border-separator pt-2.5">
              <QuickChips :items="shortcuts" :selected="calendarDay" @pick="pickDay" />
            </div>
          </div>
          <div class="flex w-48 flex-col gap-2.5 px-3 py-3.5">
            <label :for="clockId" class="text-footnote font-semibold text-content-muted">{{ t("core.form.time.label") }}</label>
            <input :id="clockId" type="text" autocomplete="off" inputmode="numeric" :value="clockEntry.text.value" :placeholder="times.placeholder.value" :aria-invalid="clockEntry.message.value ? true : undefined"
              class="rounded-control bg-fill p-1.5 text-center text-[20px] font-semibold tabular-nums text-content-strong placeholder:text-base placeholder:font-normal placeholder:text-content-disabled focus:outline-2 focus:outline-border-focus"
              @input="clockEntry.input(($event.target as HTMLInputElement).value)" @blur="clockEntry.commit()" @keydown.enter.prevent="clockEntry.commit()" />
            <TimeColumns :model-value="clockValue" :step="props.minuteStep" @update:model-value="pickTime" />
            <button type="button" class="cursor-pointer self-start rounded-full bg-tint-soft px-2.5 py-1.5 text-footnote font-medium text-content-link focus-visible:outline-2 focus-visible:outline-border-focus" @click="now(dismiss)">
              {{ t("core.form.time.now") }}
            </button>
          </div>
        </div>
      </template>
    </Popover>
  </Field>
</template>
