<script setup lang="ts">
import { nextTick } from "vue";
import { ChoiceChips, FormGroup, FormView, NumberField, SelectField, TextField, useForm, useHiddenFieldErrors, useSaveChrome } from "@wssto2/vue-core/form";
import { toast } from "@wssto2/vue-core/overlay";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const titles = [{ value: 1, label: "Mr" }, { value: 2, label: "Ms" }, { value: 3, label: "Mx" }] as const;
const brands = [{ value: "audi", label: "Audi" }, { value: "vw", label: "Volkswagen" }];
const form = useForm({ defaults: () => ({ name: "", title: 1 as 1 | 2 | 3, postalCode: null as number | null, brands: [] as string[] }) });
const hidden = useHiddenFieldErrors({ form });

async function save() {
  const result = await form.submit(async () => undefined);
  await nextTick(); // the errors whose field is not on screen are worked out after the render
  if (result.status === "failed" && hidden.value.length) toast.error(hidden.value.map((each) => `${each.field}: ${each.message}`).join("; "));
}

// A section edited in place: Save is disabled until something changed, and there is no Cancel (leaving is guarded anyway).
useSaveChrome({ form, save });
</script>

<template>
  <FormView :form="form" @submit="save">
    <FormGroup :header="t('forms.vehicles')">
      <TextField v-bind="form.bind('name')" :label="t('forms.name')" />
      <!-- Not clearable: it emits 1 | 2 | 3, never null, so the draft says so. -->
      <SelectField v-bind="form.bind('title')" :label="t('forms.title')" :options="titles" />
      <NumberField v-bind="form.bind('postalCode')" :label="t('forms.postalCode')" :grouping="false" :max-digits="5" />
      <!-- The group's header says what the chips are; the label stays their accessible name. -->
      <ChoiceChips v-bind="form.bind('brands')" :label="t('forms.brands')" label-hidden :options="brands" />
    </FormGroup>
  </FormView>
</template>
