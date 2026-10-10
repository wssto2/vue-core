<script setup lang="ts">
import { DateField, DateTimeField, FormGroup, FormView, MonthYearField, SwitchField, TimeField } from "@wssto2/vue-core/form";
import { AdaptivePageShell } from "@wssto2/vue-core/page";
import { reactive, ref } from "vue";
import { useI18n } from "vue-i18n";

// The date and time fields in one group: every value is text (a day, a date-time, a time) or two numbers (month and year), never a `Date`.
const { t } = useI18n();
const editing = ref(true);
const values = reactive({
  deliveryOn: null as string | null,
  visitAt: "2026-10-15T14:35" as string | null,
  shiftStart: null as string | null,
  slotAt: null as string | null,
  month: 3 as number | null,
  year: 2019 as number | null,
});
// The app's own shortcut: a delivery day is a working day (an app with holidays would look them up here).
const nextDelivery = (today: string) => {
  const date = new Date(`${today}T12:00:00Z`);
  do date.setUTCDate(date.getUTCDate() + 1);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6);
  return date.toISOString().slice(0, 10);
};
</script>

<template>
  <AdaptivePageShell :title="t('forms.dates.title')" :description="t('forms.dates.intro')" width="content">
    <FormView :editable="editing">
      <FormGroup :header="t('forms.dates.delivery')" :footer="t('forms.dates.deliveryHint')">
        <DateField v-model="values.deliveryOn" :label="t('forms.dates.deliveryOn')" :min="'2026-01-01'" :quick-picks="['today', 'tomorrow', { label: t('forms.dates.nextDelivery'), day: nextDelivery }, 'month-end']" />
        <DateTimeField v-model="values.visitAt" :label="t('forms.dates.visitAt')" />
        <DateTimeField v-model="values.slotAt" :label="t('forms.dates.slotAt')" :minute-step="15" />
      </FormGroup>
      <FormGroup :header="t('forms.dates.timeAndMonth')">
        <TimeField v-model="values.shiftStart" :label="t('forms.dates.shiftStart')" />
        <MonthYearField v-model:month="values.month" v-model:year="values.year" :label="t('forms.dates.firstRegistration')" />
      </FormGroup>
    </FormView>

    <!-- A half-width column: the date-time control shrinks inside its row instead of running past the card. -->
    <div id="narrow-dates" class="mt-group-gap w-[22rem] max-w-full">
      <FormView :editable="true">
        <FormGroup :header="t('forms.dates.narrow')">
          <DateField v-model="values.deliveryOn" :label="t('forms.dates.deliveryOn')" />
          <DateTimeField v-model="values.visitAt" :label="t('forms.dates.visitAt')" />
          <DateTimeField v-model="values.visitAt" :label="t('forms.dates.longLabel')" required />
          <TimeField v-model="values.shiftStart" :label="t('forms.dates.shiftStart')" />
          <MonthYearField v-model:month="values.month" v-model:year="values.year" :label="t('forms.dates.firstRegistration')" />
        </FormGroup>
      </FormView>
    </div>

    <FormGroup :header="t('forms.dates.values')" class="mt-group-gap">
      <SwitchField v-model="editing" :label="t('forms.dates.editing')" />
      <pre class="px-1 py-2 text-footnote tabular-nums text-content-muted">{{ JSON.stringify(values, null, 2) }}</pre>
    </FormGroup>
  </AdaptivePageShell>
</template>
