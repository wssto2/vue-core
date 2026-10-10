<script setup lang="ts">
import { ComboField, FormGroup, FormView, SelectField, SwitchField, TextField, type OptionWithMeta, type SelectOption } from "@wssto2/vue-core/form";
import { AdaptivePageShell } from "@wssto2/vue-core/page";
import { Badge } from "@wssto2/vue-core/state";
import { reactive, ref } from "vue";
import { useI18n } from "vue-i18n";

// Pickers with rows that say more (a photo, a VIN, a badge) in a narrow column, and a translations row with a flag in front of each language.
const { t } = useI18n();
const editing = ref(true);
interface Vehicle { readonly vin: string; readonly photo: string; readonly isNew: boolean }
const swatch = (color: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48"><rect width="64" height="48" rx="6" fill="${color}"/><rect x="8" y="24" width="48" height="12" rx="6" fill="white" opacity=".7"/></svg>`)}`;
const vehicles: readonly SelectOption<number, Vehicle>[] = [
  { value: 1, label: "Renault Clio V 1.0 TCe 90 Intens", meta: { vin: "VF15RJA0H65440123", photo: swatch("#2e6f9e"), isNew: true } },
  { value: 2, label: "Dacia Duster 1.3 TCe 130 Prestige", meta: { vin: "UU1HSDDGH63112345", photo: swatch("#8a6d3b"), isNew: false } },
  { value: 3, label: "Renault Megane E-Tech 60 kWh Techno", meta: { vin: "VF1RFB00X69812345", photo: swatch("#3b8a5e"), isNew: true } },
];
const find = async (query: string): Promise<readonly SelectOption<number, Vehicle>[]> => vehicles.filter((vehicle) => vehicle.label.toLowerCase().includes(query.toLowerCase()));
const chosen = reactive({ combo: 1 as number | null, select: 2 as number | null, wide: null as number | null });
const selected = vehicles[0] ?? null;

const flag = (stripes: readonly string[]) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="14">${stripes.map((color, index) => `<rect y="${(index * 14) / stripes.length}" width="20" height="${14 / stripes.length + 0.5}" fill="${color}"/>`).join("")}</svg>`)}`;
const countries = [
  { code: "ba", label: "Bosna i Hercegovina", flag: flag(["#002f6c", "#fecb00", "#002f6c"]) },
  { code: "hr", label: "Hrvatska", flag: flag(["#d52b1e", "#ffffff", "#171796"]) },
  { code: "rs", label: "Srbija", flag: flag(["#c6363c", "#0c4076", "#ffffff"]) },
  { code: "si", label: "Slovenija", flag: flag(["#ffffff", "#005da4", "#ed1c24"]) },
];
const translations = reactive<Record<string, string>>({ ba: "Renault Clio V Intens", hr: "Renault Clio V Intens", rs: "", si: "Renault Clio V Intens" });
const asRow = (option: OptionWithMeta<number, Vehicle>) => option; // the slot's option type is public
</script>

<template>
  <AdaptivePageShell :title="t('forms.pickers.title')" :description="t('forms.pickers.intro')" width="content">
    <div id="narrow-pickers" class="w-[22rem] max-w-full">
      <FormView :editable="true">
        <FormGroup :header="t('forms.pickers.narrow')" :footer="t('forms.pickers.narrowHint')">
          <ComboField v-model="chosen.combo" row-layout="stacked" :label="t('forms.pickers.vehicle')" :search="find" :selected="selected">
            <template #option="{ option }">
              <img :src="asRow(option).meta.photo" alt="" class="h-12 w-16 shrink-0 rounded object-cover" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-body font-medium text-content-strong">{{ option.label }}</span>
                <span class="block truncate font-mono text-footnote text-content-muted">{{ option.meta.vin }}</span>
              </span>
              <Badge v-if="option.meta.isNew" tone="positive">{{ t("forms.pickers.new") }}</Badge>
            </template>
          </ComboField>
          <SelectField v-model="chosen.select" row-layout="stacked" :label="t('forms.pickers.stock')" :options="vehicles">
            <template #option="{ option }">
              <img :src="option.meta.photo" alt="" class="h-12 w-16 shrink-0 rounded object-cover" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-body text-content-strong">{{ option.label }}</span>
                <span class="block truncate font-mono text-footnote text-content-muted">{{ option.meta.vin }}</span>
              </span>
              <Badge v-if="option.meta.isNew" tone="positive">{{ t("forms.pickers.new") }}</Badge>
            </template>
          </SelectField>
        </FormGroup>
      </FormView>
    </div>

    <FormView :editable="true">
      <FormGroup :header="t('forms.pickers.wide')" class="mt-group-gap">
        <ComboField v-model="chosen.wide" :label="t('forms.pickers.vehicle')" :search="find" width="sm">
          <template #option="{ option }">
            <img :src="option.meta.photo" alt="" class="h-12 w-16 shrink-0 rounded object-cover" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-body text-content-strong">{{ option.label }}</span>
              <span class="block truncate font-mono text-footnote text-content-muted">{{ option.meta.vin }}</span>
            </span>
          </template>
        </ComboField>
      </FormGroup>
    </FormView>

    <FormGroup :header="t('forms.pickers.translations')" :footer="t('forms.pickers.translationsHint')" class="mt-group-gap">
      <SwitchField v-model="editing" :label="t('forms.dates.editing')" />
    </FormGroup>
    <FormView :editable="editing">
      <div id="translations" class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField v-for="country in countries" :key="country.code" v-model="translations[country.code]" :label="country.label">
          <template #prefix><img :src="country.flag" alt="" class="h-3.5 w-5 rounded-[2px]" /></template>
        </TextField>
      </div>
      <FormGroup :header="t('forms.pickers.translationsRows')" class="mt-group-gap">
        <TextField v-for="country in countries" :key="country.code" v-model="translations[country.code]" :label="country.label">
          <template #prefix><img :src="country.flag" alt="" class="h-3.5 w-5 rounded-[2px]" /></template>
        </TextField>
      </FormGroup>
    </FormView>
  </AdaptivePageShell>
</template>
