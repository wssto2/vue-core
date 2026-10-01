<script setup lang="ts">
// Type fixture (checked by `npm run typecheck`, never built): a field is bound to a form's field by name and by value type.
import { useForm } from "./useForm";
import type { SelectOption } from "./options";
import CheckboxField from "./CheckboxField.vue";
import Calendar from "./date/Calendar.vue";
import DateField from "./DateField.vue";
import DateTimeField from "./DateTimeField.vue";
import MonthYearField from "./MonthYearField.vue";
import MultiSelectField from "./MultiSelectField.vue";
import NumberField from "./NumberField.vue";
import SegmentedField from "./SegmentedField.vue";
import SelectField from "./SelectField.vue";
import SwitchField from "./SwitchField.vue";
import TextField from "./TextField.vue";
import TimeField from "./TimeField.vue";

const form = useForm({
  defaults: () => ({
    name: "",
    age: null as number | null,
    status: null as "open" | "closed" | null,
    tags: [] as string[],
    on: false,
    due: null as string | null,
    month: null as number | null,
    year: null as number | null,
    mode: "a" as "a" | "b",
  }),
});
const statuses = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
] as const satisfies readonly SelectOption[];
const tagOptions: readonly SelectOption<string>[] = [{ value: "a", label: "A" }];
</script>

<template>
  <TextField v-bind="form.bind('name')" label="Name" />
  <NumberField v-bind="form.bind('age')" />
  <SelectField v-bind="form.bind('status')" :options="statuses" />
  <MultiSelectField v-bind="form.bind('tags')" :options="tagOptions" />
  <SwitchField v-bind="form.bind('on')" />
  <CheckboxField v-bind="form.bind('on')" label="On" />
  <DateField v-bind="form.bind('due')" min="2026-01-01" :quick-picks="['today', { label: 'Soon', day: (today) => today }]" :disabled-dates="[{ from: '2026-12-24', to: '2026-12-26' }]" />
  <DateTimeField v-bind="form.bind('due')" :minute-step="5" />
  <TimeField v-bind="form.bind('due')" :quick-times="['now', '08:00']" />
  <Calendar :model-value="form.values.due" />
  <!-- a segmented control never emits null, so a field that is never null binds to it -->
  <SegmentedField v-bind="form.bind('mode')" :options="[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]" />
  <MonthYearField v-bind="form.bindMonthYear('month', 'year')" />

  <!-- @vue-expect-error a misspelled field -->
  <TextField v-bind="form.bind('nmae')" />
  <!-- @vue-expect-error the field holds a number or null: a text field edits text -->
  <TextField v-bind="form.bind('age')" />
  <!-- @vue-expect-error the field holds text: a number field edits a number -->
  <NumberField v-bind="form.bind('name')" />
  <!-- @vue-expect-error the switch is a boolean -->
  <SwitchField v-bind="form.bind('name')" />
  <!-- @vue-expect-error a select can be cleared, so the field it edits can be null -->
  <SelectField v-bind="form.bind('mode')" :options="[{ value: 'a', label: 'A' }]" />
  <!-- @vue-expect-error the options must be able to produce the field's values: "archived" is not a status -->
  <SelectField v-bind="form.bind('status')" :options="[{ value: 'archived', label: 'Archived' }]" />
  <!-- @vue-expect-error a date is text: a number field of the form is not a day -->
  <DateField v-bind="form.bind('age')" />
  <!-- @vue-expect-error a date and time is text -->
  <DateTimeField v-bind="form.bind('age')" />
  <!-- @vue-expect-error a time is text -->
  <TimeField v-bind="form.bind('age')" />
  <!-- @vue-expect-error a misspelled field -->
  <TimeField v-bind="form.bind('start')" />
  <!-- @vue-expect-error min is a day as text, never a Date -->
  <DateField v-bind="form.bind('due')" :min="new Date()" />
  <!-- @vue-expect-error a quick pick the library does not know -->
  <DateField v-bind="form.bind('due')" :quick-picks="['yesterday']" />
  <!-- @vue-expect-error the minute step is a number -->
  <DateTimeField v-bind="form.bind('due')" minute-step="5" />
  <!-- @vue-expect-error a month is a number field of the form -->
  <MonthYearField v-bind="form.bindMonthYear('name', 'year')" />
</template>
