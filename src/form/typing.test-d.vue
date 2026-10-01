<script setup lang="ts">
// Type fixture (checked by `npm run typecheck`, never built): a field is bound to a form's field by name and by value type.
import { useForm } from "./useForm";
import type { SelectOption } from "./options";
import CheckboxField from "./CheckboxField.vue";
import DateField from "./DateField.vue";
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
  <DateField v-bind="form.bind('due')" />
  <!-- a segmented control never emits null, so a field that is never null binds to it -->
  <SegmentedField v-bind="form.bind('mode')" :options="[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]" />
  <MonthYearField v-bind="form.bindMonthYear('month', 'year')" />
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
  <!-- @vue-expect-error a select can be cleared, so the field it edits can be null -->
  <SelectField v-bind="form.bind('mode')" :options="[{ value: 'a', label: 'A' }]" />
  <!-- @vue-expect-error the options must be able to produce the field's values: "archived" is not a status -->
  <SelectField v-bind="form.bind('status')" :options="[{ value: 'archived', label: 'Archived' }]" />
  <!-- @vue-expect-error a month is a number field of the form -->
  <MonthYearField v-bind="form.bindMonthYear('name', 'year')" />
</template>
