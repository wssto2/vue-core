<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import DateButton from "../controls/DateButton.vue";
import { useFormat } from "../format";
import { Icon } from "../icon";
import { useCompactPresentation } from "../internal/mediaQuery";
import Popover from "../overlay/Popover.vue";
import { useControlSurface } from "./control";
import Calendar from "./date/Calendar.vue";
import DatePickerSheet from "./date/DatePickerSheet.vue";
import { isDay, type Day, type DayRules, type DisabledDates } from "./date/days";
import QuickChips from "./date/QuickChips.vue";
import type { QuickPick } from "./date/quickPicks";
import { useDateText } from "./date/useDateText";
import { useDayShortcuts } from "./date/useShortcuts";
import { useTypedEntry } from "./date/useTypedEntry";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, type FieldProps, type FieldSlots } from "./field";

/**
 * A calendar day, without a time or a zone: `"2026-09-30"`, or `null`. Typing is the main way in and is forgiving: the
 * app's own format (`30.09.2026.`), `30.9.` (this year), `+7` and `-1` (days from today) and the words for today and
 * tomorrow. A calendar opens in a popover (a half sheet with quick picks on a phone) for those who would rather pick.
 * The value is text, never a `Date`, so a day cannot drift across time zones; text that is not a real day stays in the
 * field next to its message and the value is `null` until it is.
 *
 *   <DateField v-bind="form.bind('dueOn')" :label="t('dueOn')" min="2026-01-01" />
 *   <DateField v-bind="form.bind('visitOn')" :label="t('visit')" :quick-picks="['today', { label: t('nextDelivery'), day: nextDeliveryDay }]" />
 *
 * `min` and `max` are days; `disabledDates` are days, `{ from, to }` ranges or a function; `openOn` is the month an empty
 * calendar opens on (today's by default). `quickPicks` replaces the shortcuts (the library's own wording for the named ones).
 * Read mode shows the day in the app's format.
 */
const props = withDefaults(
  defineProps<
    FieldProps & {
      min?: Day;
      max?: Day;
      disabledDates?: DisabledDates;
      openOn?: Day;
      quickPicks?: readonly QuickPick[];
    }
  >(),
  { ...fieldDefaults, min: undefined, max: undefined, disabledDates: undefined, openOn: undefined, quickPicks: undefined },
);

const model = defineModel<string | null>({ default: null });
const { t } = useI18n();
const format = useFormat();
const compact = useCompactPresentation();
const input = useTemplateRef<HTMLInputElement>("input");
const popover = useTemplateRef<InstanceType<typeof Popover>>("popover");
const calendar = useTemplateRef<InstanceType<typeof Calendar>>("calendar");
const sheet = useTemplateRef<InstanceType<typeof DatePickerSheet>>("sheet");

const rules = computed<DayRules>(() => ({ min: props.min, max: props.max, disabled: props.disabledDates }));
const text = useDateText(() => rules.value);
const entry = useTypedEntry({
  model,
  display: (value) => format.date(value),
  parse: (typed) => {
    const day = text.parse(typed);
    if (!day) return { error: text.invalidMessage() };
    return text.available(day) ? { value: day } : { error: text.unavailableMessage() };
  },
});
const shortcuts = useDayShortcuts(() => props.quickPicks, () => compact.value, () => rules.value);

const shownError = computed(() => props.error || entry.message.value);
const shown = computed(() => (model.value ? format.date(model.value) : null));
const surface = useControlSurface("date", () => (shownError.value ? "error" : props.disabled ? "locked" : "rest"));
/** The calendar shows what is typed while it is a real day. */
const calendarDay = computed(() => entry.typed.value ?? (isDay(model.value) ? model.value : null));

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

function pick(day: string, dismiss: () => void) {
  entry.set(day);
  dismiss();
}

defineExpose({ focus: () => input.value?.focus() });
defineSlots<FieldSlots>();
</script>

<template>
  <Field v-bind="{ ...fieldProps(props), error: shownError }" :value="shown" value-style="numeric">
    <template #default="{ id, describedby, invalid }">
      <template v-if="compact">
        <DateButton v-bind="{ id, 'aria-describedby': describedby }" :disabled="props.disabled" :invalid="invalid" :placeholder="t('core.form.select.choose')" @click="sheet?.present()">
          <template v-if="shown">{{ shown }}</template>
        </DateButton>
        <DatePickerSheet ref="sheet" :title="props.label ?? t('core.form.date.calendar')" mode="date" :model-value="model" :min="props.min" :max="props.max" :disabled-dates="props.disabledDates"
          :open-on="props.openOn" :shortcuts="shortcuts" :clearable="!props.required" @update:model-value="entry.set" />
      </template>

      <Popover v-else ref="popover" :label="props.label ?? t('core.form.date.calendar')" width="lg" placement="bottom-start" :arrow="false" :autofocus="false">
        <template #trigger="{ attrs, presented }">
          <div class="inline-flex max-w-full items-center gap-2" :class="surface">
            <input :id="id" ref="input" v-bind="attrs" type="text" role="combobox" autocomplete="off" size="16" :name="props.name" :value="entry.text.value" :placeholder="text.placeholder.value"
              :disabled="props.disabled" :required="props.required" :aria-required="props.required || undefined" :aria-invalid="invalid || undefined" :aria-describedby="describedby"
              class="block min-h-7 min-w-0 border-0 bg-transparent py-1 pl-2.5 text-body tabular-nums text-content-strong placeholder:text-content-disabled focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
              @input="entry.input(($event.target as HTMLInputElement).value)" @blur="entry.commit()" @keydown="onKeydown" @click="open(false)" />
            <button v-if="!props.disabled" type="button" tabindex="-1" :aria-label="t('core.form.date.open')" class="mr-2 flex shrink-0 cursor-pointer items-center text-content-link" @click="presented ? popover?.dismiss() : open(true)">
              <Icon name="calendarLine" :size="18" />
            </button>
          </div>
        </template>

        <template #default="{ dismiss }">
          <div class="flex flex-col gap-2.5">
            <Calendar ref="calendar" :model-value="calendarDay" :min="props.min" :max="props.max" :disabled-dates="props.disabledDates" :open-on="props.openOn" month-picker
              @update:model-value="pick($event!, dismiss)" />
            <div v-if="shortcuts.length > 0" class="border-t border-border-separator pt-2.5">
              <QuickChips :items="shortcuts" :selected="calendarDay" @pick="pick($event, dismiss)" />
            </div>
            <p class="text-footnote text-content-muted">{{ t("core.form.date.keys") }}</p>
          </div>
        </template>
      </Popover>
    </template>
    <template v-if="$slots.trailing" #trailing><slot name="trailing" /></template>
    <template v-if="$slots.labelTrailing" #labelTrailing><slot name="labelTrailing" /></template>
    <template v-if="$slots.readonly" #readonly><slot name="readonly" /></template>
  </Field>
</template>
