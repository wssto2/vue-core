<script setup lang="ts">
import { FormGroup, MoneyField, SelectField, TextField, useForm, type SelectOption } from "@wssto2/vue-core/form";
import { useI18n } from "vue-i18n";

interface Paint { readonly hex: string }
const { t } = useI18n();
const form = useForm({ defaults: () => ({ vin: "", transport: 0 as number | null, colour: null as number | null }) });
const colours: readonly SelectOption<number, Paint>[] = [{ value: 1, label: "Flame red", meta: { hex: "#c0392b" } }, { value: 2, label: "Iron blue", meta: { hex: "#2e6f9e" } }];
const lookUp = (_vin: string) => undefined; // the feature's check: a request through its api.ts
</script>

<template>
  <FormGroup>
    <TextField v-bind="form.bind('vin')" :label="t('forms.vin')" mono @blur="lookUp(form.values.vin)" />
    <MoneyField v-bind="form.bind('transport')" :label="t('forms.transport')" currency="EUR" blank-zero />
    <SelectField v-bind="form.bind('colour')" :label="t('forms.colour')" :options="colours">
      <template #value="{ option }"><span class="inline-block size-3 rounded-full align-middle" :style="{ background: option.meta.hex }" /> {{ option.label }}</template>
    </SelectField>
  </FormGroup>
</template>
