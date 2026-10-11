<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import DateButton from "../controls/DateButton.vue";
import { Icon } from "../icon";
import Popover from "../overlay/Popover.vue";
import MonthYearPanel from "./date/MonthYearPanel.vue";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, type FieldProps, type FieldSlots } from "./field";

/**
 * A month and a year shown as one date button, kept as two numbers (`month` 1 to 12, `year`), the way a record stores a
 * first registration. The button opens a popover with the year (arrows step it; clicking it opens a grid of twelve years,
 * so 2008 is two clicks away) and the twelve months. Bind both:
 *
 *   <MonthYearField v-bind="form.bindMonthYear('regMonth', 'regYear')" :label="t('firstRegistration')" />
 *
 * Month names come from the library's texts, so every market gets its own language whatever the browser's data lacks.
 */
const props = withDefaults(
  defineProps<FieldProps & { minYear?: number; maxYear?: number; /** Shown while both are empty; by default the library's "Choose…". */ placeholder?: string }>(),
  { ...fieldDefaults, placeholder: undefined, minYear: 1970, maxYear: () => new Date().getFullYear() + 1 },
);

const month = defineModel<number | null>("month", { default: null });
const year = defineModel<number | null>("year", { default: null });
const { t } = useI18n();

const hasMonth = computed(() => month.value !== null && month.value >= 1 && month.value <= 12);
const name = (value: number, form: "long" | "short") => t(`core.form.months.${form}.${value}`);
const shown = computed(() => {
  if (hasMonth.value && year.value !== null) return t("core.form.months.with_year", { month: name(month.value as number, "long"), year: year.value });
  if (year.value !== null) return String(year.value);
  return hasMonth.value ? name(month.value as number, "long") : "";
});

function pick(value: { month: number; year: number }, dismiss: () => void) {
  month.value = value.month;
  year.value = value.year;
  dismiss();
}
function clear(dismiss: () => void) {
  month.value = null;
  year.value = null;
  dismiss();
}
defineSlots<FieldSlots>();
</script>

<template>
  <Field v-bind="fieldProps(props)" :value="shown || null">
    <template #default="{ id, describedby, invalid }">
      <Popover :label="props.label ?? shown" width="sm" placement="bottom-start" :arrow="false">
        <template #trigger="{ toggle, presented }">
          <DateButton v-bind="{ id, 'aria-describedby': describedby }" :expanded="presented" :disabled="props.disabled" :invalid="invalid" :placeholder="props.placeholder ?? t('core.form.select.choose')" @click="toggle">
            <template v-if="shown">{{ shown }}<Icon name="calendarLine" :size="16" class="ml-2 shrink-0 text-content-muted" /></template>
          </DateButton>
        </template>
        <template #default="{ dismiss }">
          <div class="flex flex-col gap-2">
            <MonthYearPanel :month="month" :year="year" :min-year="props.minYear" :max-year="props.maxYear" @pick="pick($event, dismiss)" />
            <button v-if="hasMonth || year !== null" type="button" class="cursor-pointer self-start rounded-control px-1 text-footnote text-content-link" @click="clear(dismiss)">{{ t("core.form.select.clear") }}</button>
          </div>
        </template>
      </Popover>
    </template>
    <template v-if="$slots.trailing" #trailing><slot name="trailing" /></template>
    <template v-if="$slots.labelTrailing" #labelTrailing><slot name="labelTrailing" /></template>
    <template v-if="$slots.readonly" #readonly><slot name="readonly" /></template>
  </Field>
</template>
