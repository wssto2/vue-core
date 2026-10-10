<script setup lang="ts">
import { ComboField, FormGroup, TextField, useForm, type OptionWithMeta, type SelectOption } from "@wssto2/vue-core/form";
import { useI18n } from "vue-i18n";

interface Vehicle { readonly vin: string; readonly photo: string }
const { t } = useI18n();
const form = useForm({ defaults: () => ({ vehicle: null as number | null, translation: "" }) });
const vehicles: readonly SelectOption<number, Vehicle>[] = [{ value: 1, label: "Renault Clio V 1.0 TCe", meta: { vin: "VF15RJA0H65440123", photo: "/clio.jpg" } }];
const find = async (_query: string): Promise<readonly SelectOption<number, Vehicle>[]> => vehicles;
const vin = (option: OptionWithMeta<number, Vehicle>) => option.meta.vin;
</script>

<template>
  <FormGroup>
    <ComboField v-bind="form.bind('vehicle')" row-layout="stacked" :label="t('forms.vehicle')" :search="find">
      <template #option="{ option }">
        <img :src="option.meta.photo" alt="" class="h-12 w-16 shrink-0 rounded object-cover" />
        <span class="min-w-0 flex-1"><span class="block truncate">{{ option.label }}</span><span class="block truncate font-mono text-footnote">{{ vin(option) }}</span></span>
      </template>
    </ComboField>
    <TextField v-bind="form.bind('translation')" :label="t('forms.translation')">
      <template #prefix><img src="/flags/ba.png" alt="" class="h-3.5 w-5" /></template>
    </TextField>
  </FormGroup>
</template>
