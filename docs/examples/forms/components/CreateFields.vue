<script setup lang="ts">
import { FormGroup, NumberField, TextField } from "@wssto2/vue-core/form";
import { useI18n } from "vue-i18n";
import type { CreateTicketForm } from "../form";

const props = defineProps<{ form: CreateTicketForm }>();
const { t } = useI18n();
</script>

<template>
  <FormGroup>
    <TextField v-bind="props.form.bind('subject')" :label="t('forms.subject')" required />
    <NumberField v-bind="props.form.bind('priority')" :label="t('forms.priority')" />
  </FormGroup>
</template>
