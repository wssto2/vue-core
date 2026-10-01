<script setup lang="ts">
import { DateField, DateTimeField, FormGroup, MonthYearField, TimeField, useForm } from "@wssto2/vue-core/form";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

// Days are text ("2026-09-30"), date-times wall-clock text ("2026-09-30T14:35"), a time "14:35", a month and year two numbers: never a Date.
const form = useForm({
  defaults: () => ({
    deliveryOn: null as string | null,
    visitAt: null as string | null,
    shiftStart: null as string | null,
    firstMonth: null as number | null,
    firstYear: null as number | null,
  }),
});

// The app's own shortcut: the library skips Saturday and Sunday only; a market with public holidays says its own rule.
const nextDeliveryDay = (today: string): string => {
  const date = new Date(`${today}T12:00:00Z`);
  do date.setUTCDate(date.getUTCDate() + 1);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6);
  return date.toISOString().slice(0, 10);
};
</script>

<template>
  <FormGroup>
    <DateField v-bind="form.bind('deliveryOn')" :label="t('forms.deliveryOn')" min="2026-01-01" :quick-picks="['today', 'tomorrow', { label: t('forms.nextDelivery'), day: nextDeliveryDay }]" />
    <DateTimeField v-bind="form.bind('visitAt')" :label="t('forms.visitAt')" min="2026-10-01T08:00" :minute-step="15" />
    <TimeField v-bind="form.bind('shiftStart')" :label="t('forms.shiftStart')" />
    <MonthYearField v-bind="form.bindMonthYear('firstMonth', 'firstYear')" :label="t('forms.firstRegistration')" />
  </FormGroup>
</template>
