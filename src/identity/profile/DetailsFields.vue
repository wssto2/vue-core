<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { FormGroup, FormRow, TextField, type FieldBinding } from "../../form";

/** The details group, written once: the page reads it, and the sheet shows this same markup with its group alone. */
const props = defineProps<{ bind: (field: "name" | "phone") => FieldBinding<string>; login: string }>();
const { t } = useI18n();
</script>

<template>
  <FormGroup group="details" :header="t('core.profile.details.title')" :footer="t('core.profile.details.login_hint')">
    <TextField v-bind="props.bind('name')" :label="t('core.users.fields.name')" required autocomplete="name" />
    <TextField v-bind="props.bind('phone')" :label="t('core.users.fields.phone')" type="tel" autocomplete="tel" />
    <FormRow layout="value" :label="t('core.users.fields.login')" data-profile-login><span class="font-mono">{{ props.login }}</span></FormRow>
  </FormGroup>
</template>
