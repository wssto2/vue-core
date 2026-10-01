<script setup lang="ts">
import { FormGroup, SegmentedField, SelectField, TextareaField, TextField, type SelectOption } from "@wssto2/vue-core/form";
import { PhoneField } from "@wssto2/vue-core/phone";
import { useI18n } from "vue-i18n";
import { api } from "../api";
import type { AccountForm } from "../form";

// The account's groups, written once: the record page reads them, and each group's sheet shows the same markup with its group alone.
const props = defineProps<{ form: AccountForm }>();
const { t } = useI18n();

const channels: readonly SelectOption<"email" | "phone">[] = [
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Phone" },
];
const countries: readonly SelectOption<string>[] = [
  { value: "HR", label: "Croatia" },
  { value: "BA", label: "Bosnia and Herzegovina" },
  { value: "SI", label: "Slovenia" },
];
const bind = props.form.bind;
</script>

<template>
  <FormGroup group="identity" :header="t('forms.groups.identity')" :locked-footer="t('forms.groups.identity_locked')">
    <TextField v-bind="bind('name')" :label="t('forms.fields.name')" required />
    <TextField v-bind="bind('taxId')" :label="t('forms.fields.taxId')" mono :hint="t('forms.fields.taxIdHint')" />
  </FormGroup>

  <FormGroup group="contact" :header="t('forms.groups.contact')">
    <TextField v-bind="bind('email')" type="email" :label="t('forms.fields.email')" />
    <PhoneField v-bind="bind('mobile')" :label="t('forms.fields.mobile')" />
    <PhoneField v-bind="bind('phone')" :label="t('forms.fields.phone')" default-country="BA" />
    <SegmentedField v-bind="bind('channel')" :label="t('forms.fields.channel')" :options="channels" />
  </FormGroup>

  <FormGroup group="address" :header="t('forms.groups.address')">
    <TextField v-bind="bind('street')" :label="t('forms.fields.street')" />
    <!-- Suggestions while typing: free text stays a string; the server is asked after a pause and the older request is aborted. -->
    <TextField v-bind="bind('city')" :label="t('forms.fields.city')" :suggestions="(query, { signal }) => api.cities(query, signal)" recents="city" required />
    <SelectField v-bind="bind('country')" :label="t('forms.fields.country')" :options="countries" clearable />
  </FormGroup>

  <FormGroup group="notes" :header="t('forms.groups.notes')">
    <TextareaField v-bind="bind('notes')" :label="t('forms.fields.notes')" :max-length="200" stacked />
  </FormGroup>
</template>
