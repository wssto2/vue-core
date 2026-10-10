<script setup lang="ts">
import { FormGroup, FormView, MoneyField, SelectField, TextField, type SelectOption } from "@wssto2/vue-core/form";
import { AdaptivePageShell } from "@wssto2/vue-core/page";
import { reactive, ref } from "vue";
import { useI18n } from "vue-i18n";

// Three field behaviours: @blur runs a check, blank-zero shows a 0 as an empty field (the value stays 0), #value draws the chosen option as its rows do.
const { t } = useI18n();
const editing = ref(true);
const values = reactive({ vin: "VF15RJA0H65440123", transport: 0 as number | null, customs: 120 as number | null, colour: 1 as number | null });
const checked = ref("");
const check = () => (checked.value = values.vin);

interface Paint { readonly hex: string }
const colours: readonly SelectOption<number, Paint>[] = [
  { value: 1, label: "Flame red", meta: { hex: "#c0392b" } },
  { value: 2, label: "Iron blue", meta: { hex: "#2e6f9e" } },
  { value: 3, label: "Moss green", meta: { hex: "#3b8a5e" } },
];
</script>

<template>
  <AdaptivePageShell :title="t('forms.events.title')" :description="t('forms.events.intro')" width="content">
    <FormView :editable="editing">
      <FormGroup>
        <TextField v-model="values.vin" :label="t('forms.events.vin')" :hint="t('forms.events.vinHint')" mono @blur="check" />
        <MoneyField v-model="values.transport" :label="t('forms.events.transport')" currency="EUR" blank-zero />
        <MoneyField v-model="values.customs" :label="t('forms.events.customs')" currency="EUR" blank-zero />
        <SelectField v-model="values.colour" :label="t('forms.events.colour')" :options="colours">
          <template #option="{ option }">
            <span class="inline-block size-3.5 shrink-0 rounded-full" :style="{ background: option.meta.hex }" /><span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
          </template>
          <template #value="{ option }">
            <span class="inline-block size-3 rounded-full align-middle" :style="{ background: option.meta.hex }" /> {{ option.label }}
          </template>
        </SelectField>
      </FormGroup>
    </FormView>
    <p id="events-status" class="mt-group-gap px-row-inset text-footnote text-content-muted">
      {{ checked ? t("forms.events.checked", { vin: checked }) : t("forms.events.unchecked") }} · {{ t("forms.events.sent", { transport: values.transport ?? "null", customs: values.customs ?? "null" }) }}
    </p>
    <label class="mt-2 flex items-center gap-2 px-row-inset text-footnote text-content-muted"><input v-model="editing" type="checkbox" /> {{ t("forms.dates.editing") }}</label>
  </AdaptivePageShell>
</template>
