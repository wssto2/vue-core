<script setup lang="ts">
import { ChoiceChips, FormGroup, FormView, NumberField, SelectField, TextField, useForm, useSaveChrome, type SelectOption } from "@wssto2/vue-core/form";
import { toast } from "@wssto2/vue-core/overlay";
import { useI18n } from "vue-i18n";

// A section edited in place (a dealer's record section): Save in the page chrome, disabled while nothing changed, no Cancel.
// It calls useSaveChrome, so it must render inside the page shell.
const { t } = useI18n();
const salutations: readonly SelectOption<1 | 2 | 3>[] = [
  { value: 1, label: t("forms.section.mr") },
  { value: 2, label: t("forms.section.ms") },
  { value: 3, label: t("forms.section.mx") },
];
const brands: readonly SelectOption<string>[] = [{ value: "audi", label: "Audi" }, { value: "skoda", label: "Škoda" }, { value: "vw", label: "Volkswagen" }];

const form = useForm({ defaults: () => ({ name: "Auto Zagreb", salutation: 1 as 1 | 2 | 3, postalCode: 10000 as number | null, brands: ["vw"] as string[] }) });

async function save() {
  const result = await form.submit(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return form.values;
  }, { hydrateFrom: (saved) => ({ ...saved }) });
  if (result.status === "saved") toast.success(t("forms.section.saved"));
}

useSaveChrome({ form, save });
</script>

<template>
  <FormView :form="form" @submit="save">
    <FormGroup :header="t('forms.section.group')" :footer="t('forms.section.hint')">
      <TextField v-bind="form.bind('name')" :label="t('forms.section.name')" />
      <SelectField v-bind="form.bind('salutation')" :label="t('forms.section.salutation')" :options="salutations" />
      <NumberField v-bind="form.bind('postalCode')" :label="t('forms.section.postalCode')" :grouping="false" :max-digits="5" />
    </FormGroup>
    <!-- The header says what the chips are: the label stays their name for a screen reader but is not drawn. -->
    <FormGroup :header="t('forms.section.vehicles')">
      <ChoiceChips v-bind="form.bind('brands')" :label="t('forms.section.vehicles')" label-hidden :options="brands" />
    </FormGroup>
  </FormView>
</template>
