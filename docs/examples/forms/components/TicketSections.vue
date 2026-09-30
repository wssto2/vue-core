<script setup lang="ts">
import { FormGroup, NumberField, TextField, DateField } from "@wssto2/vue-core/form";
import { useI18n } from "vue-i18n";
import type { TicketValues } from "../form";
import type { RecordForm } from "@wssto2/vue-core/form";
import type { Ticket } from "../api";

// The ticket's groups, written once: the record page reads them, and each group's sheet shows this same markup with its group alone.
const props = defineProps<{ form: RecordForm<Ticket, TicketValues> }>();
const { t } = useI18n();
const bind = props.form.bind;
</script>

<template>
  <FormGroup group="details" :header="t('forms.details')">
    <TextField v-bind="bind('subject')" :label="t('forms.subject')" required />
    <NumberField v-bind="bind('priority')" :label="t('forms.priority')" />
    <DateField v-bind="bind('dueOn')" :label="t('forms.dueOn')" />
  </FormGroup>

  <FormGroup group="contact" :header="t('forms.contact')">
    <TextField v-bind="bind('email')" type="email" :label="t('forms.email')" />
    <TextField v-bind="bind('phone')" type="tel" :label="t('forms.phone')" />
  </FormGroup>
</template>
