<script setup lang="ts">
// Type fixture (checked by `npm run typecheck`, never built): a field is bound to a form's field by name and by value type.
import { useForm } from "./useForm";
import type { SelectOption } from "./options";
import CheckboxField from "./CheckboxField.vue";
import Calendar from "./date/Calendar.vue";
import DateField from "./DateField.vue";
import DateTimeField from "./DateTimeField.vue";
import I18nField from "./I18nField.vue";
import MonthYearField from "./MonthYearField.vue";
import MultiSelectField from "./MultiSelectField.vue";
import NumberField from "./NumberField.vue";
import ComboField from "./ComboField.vue";
import PhoneField from "../phone/PhoneField.vue";
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
    title3: 1 as 1 | 2 | 3,
    title: {} as Record<string, string>,
    customerId: null as number | null,
    mobile: "",
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
  <!-- a select that cannot be emptied never emits null, so a field that is never null binds to it; a clearable one binds a nullable field -->
  <SelectField v-bind="form.bind('title3')" :options="[{ value: 1, label: 'Mr' }, { value: 2, label: 'Ms' }, { value: 3, label: 'Mx' }]" />
  <SelectField v-bind="form.bind('status')" clearable :options="statuses" />
  <I18nField v-bind="form.bind('title')" :required-locales="['hr']" />
  <PhoneField v-bind="form.bind('mobile')" default-country="BA" :common-countries="['DE', 'AT']" />
  <!-- free text stays a string whatever it suggests; a record pick keeps its id type -->
  <TextField v-bind="form.bind('name')" :suggestions="['Zagreb', { text: 'Split', detail: 'Croatia' }]" recents="city" />
  <TextField v-bind="form.bind('name')" :suggestions="async (query: string) => [query]" />
  <ComboField v-bind="form.bind('customerId')" :search="async () => [{ value: 7, label: 'Ann' }]" recents="customer" />

  <!-- @vue-expect-error a phone number is stored as text -->
  <PhoneField v-bind="form.bind('age')" />
  <!-- @vue-expect-error a country is an ISO code libphonenumber knows -->
  <PhoneField v-bind="form.bind('mobile')" default-country="XX" />
  <!-- @vue-expect-error a text in several languages is a record by locale, not one string -->
  <I18nField v-bind="form.bind('name')" />
  <!-- @vue-expect-error a text field cannot edit a record by locale -->
  <TextField v-bind="form.bind('title')" />
  <!-- @vue-expect-error suggested texts are strings -->
  <TextField v-bind="form.bind('name')" :suggestions="[1, 2]" />
  <!-- @vue-expect-error a combo's options hold the field's id type -->
  <ComboField v-bind="form.bind('customerId')" :search="async () => [{ value: 'x', label: 'Ann' }]" />
  <!-- @vue-expect-error a misspelled field -->
  <TextField v-bind="form.bind('nmae')" />
  <!-- @vue-expect-error the field holds a number or null: a text field edits text -->
  <TextField v-bind="form.bind('age')" />
  <!-- @vue-expect-error the field holds text: a number field edits a number -->
  <NumberField v-bind="form.bind('name')" />
  <!-- @vue-expect-error the switch is a boolean -->
  <SwitchField v-bind="form.bind('name')" />
  <!-- @vue-expect-error a clearable select can emit null, so the field it edits can be null -->
  <SelectField v-bind="form.bind('mode')" clearable :options="[{ value: 'a', label: 'A' }]" />
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
