<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";
import DateButton from "../controls/DateButton.vue";
import Popover from "../overlay/Popover.vue";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, type FieldProps } from "./field";

/**
 * A month and a year shown as one date button, kept as two numbers (`month` 1 to 12, `year`), the way a record stores
 * a first registration. The button opens a popover with a year stepper and the twelve months. Bind both:
 *
 *   <MonthYearField v-bind="form.bindMonthYear('regMonth', 'regYear')" :label="t('firstRegistration')" />
 *
 * Month names come from the library's texts, so every market gets its own language whatever the browser's data lacks.
 */
const props = withDefaults(
  defineProps<FieldProps & { minYear?: number; maxYear?: number }>(),
  { ...fieldDefaults, minYear: 1970, maxYear: () => new Date().getFullYear() + 1 },
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

const now = new Date().getFullYear();
const viewYear = ref(year.value ?? Math.min(Math.max(now, props.minYear), props.maxYear));
watch(year, (value) => {
  if (value !== null) viewYear.value = value;
});
const step = (by: number) => (viewYear.value = Math.min(props.maxYear, Math.max(props.minYear, viewYear.value + by)));

function pick(value: number, dismiss: () => void) {
  month.value = value;
  year.value = viewYear.value;
  dismiss();
}
function clear(dismiss: () => void) {
  month.value = null;
  year.value = null;
  dismiss();
}
</script>

<template>
  <Field v-slot="{ id, describedby, invalid }" v-bind="fieldProps(props)" :value="shown || null">
    <Popover :label="props.label ?? shown" width="sm" placement="bottom-start" :arrow="false">
      <template #trigger="{ toggle, presented }">
        <DateButton v-bind="{ id, 'aria-describedby': describedby }" :expanded="presented" :disabled="props.disabled" :invalid="invalid" @click="toggle">{{ shown }}</DateButton>
      </template>
      <template #default="{ dismiss }">
        <div class="flex flex-col gap-2" data-test="month-year-picker">
          <div class="flex items-center justify-between">
            <button type="button" :disabled="viewYear <= props.minYear" :aria-label="String(viewYear - 1)" class="flex size-8 cursor-pointer items-center justify-center rounded-control hover:bg-fill disabled:opacity-40" @click="step(-1)">
              <Icon name="arrowLeftSLine" :size="18" />
            </button>
            <span class="text-body font-semibold tabular-nums">{{ viewYear }}</span>
            <button type="button" :disabled="viewYear >= props.maxYear" :aria-label="String(viewYear + 1)" class="flex size-8 cursor-pointer items-center justify-center rounded-control hover:bg-fill disabled:opacity-40" @click="step(1)">
              <Icon name="arrowRightSLine" :size="18" />
            </button>
          </div>
          <div class="grid grid-cols-3 gap-1">
            <button v-for="value in 12" :key="value" type="button" :aria-pressed="month === value && year === viewYear"
              class="min-h-9 cursor-pointer rounded-control px-1 text-body focus-visible:outline-2 focus-visible:outline-border-focus"
              :class="month === value && year === viewYear ? 'bg-tint-soft font-semibold text-content-link' : 'hover:bg-fill'" @click="pick(value, dismiss)">
              {{ name(value, "short") }}
            </button>
          </div>
          <button v-if="hasMonth || year !== null" type="button" class="cursor-pointer self-start rounded-control px-1 text-footnote text-content-link" @click="clear(dismiss)">{{ t("core.form.select.clear") }}</button>
        </div>
      </template>
    </Popover>
  </Field>
</template>
