<script setup lang="ts">
import { ComboField, FormGroup, I18nField, missingLocales, TextField, useForm } from "@wssto2/vue-core/form";
import { isValidPhone, PhoneField } from "@wssto2/vue-core/phone";
import { useI18n } from "vue-i18n";
import type { TicketFormsApi } from "../api";

const props = defineProps<{ api: TicketFormsApi }>();
const { t } = useI18n();

interface Values {
  mobile: string;
  landline: string;
  city: string;
  assignee: number | null;
  title: Record<string, string>;
}

const form = useForm({
  defaults: (): Values => ({ mobile: "", landline: "", city: "", assignee: null, title: {} }),
  validator: {
    safeParse: (input) => {
      const values = input as Values;
      const issues: { path: string[]; message: string }[] = [];
      // The phone field says what is wrong once it is left; only a validator stops the save.
      for (const field of ["mobile", "landline"] as const) if (!isValidPhone(values[field])) issues.push({ path: [field], message: t("forms.badPhone") });
      if (missingLocales(values.title, ["hr"]).length > 0) issues.push({ path: ["title"], message: t("forms.titleRequired") });
      return issues.length > 0 ? { success: false, error: { issues } } : { success: true, data: values };
    },
  },
});
</script>

<template>
  <FormGroup>
    <PhoneField v-bind="form.bind('mobile')" :label="t('forms.mobile')" />
    <PhoneField v-bind="form.bind('landline')" :label="t('forms.landline')" default-country="BA" />
    <TextField v-bind="form.bind('city')" :label="t('forms.city')" :suggestions="(query, { signal }) => props.api.cities(query, signal)" recents="city" />
    <ComboField v-bind="form.bind('assignee')" :label="t('forms.assignee')" :search="(query, { signal }) => props.api.users(query, signal)" recents="assignee" />
    <I18nField v-bind="form.bind('title')" :label="t('forms.title')" :required-locales="['hr']" />
  </FormGroup>
</template>
