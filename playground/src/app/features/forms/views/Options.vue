<script setup lang="ts">
import { ApiError } from "@wssto2/vue-core/client";
import { Button } from "@wssto2/vue-core/button";
import { CommandDialog, FormGroup, FormView, MultiSelectField, NumberField, SegmentedField, SelectField, SwitchField, TextField, useOptions, useRecordDialog, type SelectOption } from "@wssto2/vue-core/form";
import { toast } from "@wssto2/vue-core/overlay";
import { AdaptivePageShell } from "@wssto2/vue-core/page";
import { reactive, ref } from "vue";
import { useI18n } from "vue-i18n";

// Options that load: the model depends on the make, the equipment on the model. Slow on purpose (pick the delay), failing on demand.
const { t } = useI18n();
const delay = ref(1500);
const failing = ref(false);
const asked = ref(0);

const values = reactive({ make: null as string | null, model: null as string | null, equipment: [] as string[], year: 2024 as number | null, latitude: 43.566139 as number | null, longitude: 18.413029 as number | null, sum: 1234567 as number | null });

const catalogue: Record<string, readonly string[]> = {
  audi: ["A3", "A4", "Q3", "Q5"],
  skoda: ["Fabia", "Octavia", "Superb"],
  vw: ["Golf", "Passat", "Tiguan"],
};
const makes: readonly SelectOption<string>[] = [{ value: "audi", label: "Audi" }, { value: "skoda", label: "Škoda" }, { value: "vw", label: "Volkswagen" }];

/** A request that takes `delay` ms, can fail, and stops when its signal says so (the page never sees the answer then). */
function answer<Item>(items: readonly Item[], signal: AbortSignal): Promise<readonly Item[]> {
  asked.value++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => (failing.value ? reject(new ApiError({ kind: "network", message: "offline" })) : resolve(items)), delay.value);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new ApiError({ kind: "aborted", message: "aborted" }));
    });
  });
}

const models = useOptions({
  for: () => values.make,
  load: (make, { signal }) => answer((catalogue[make] ?? []).map((model): SelectOption<string> => ({ value: model.toLowerCase(), label: model })), signal),
});
const equipment = useOptions({
  for: () => values.model,
  load: (model, { signal }) => answer(["Navigation", "Sunroof", "Heated seats", "Towbar"].map((name): SelectOption<string> => ({ value: `${model}-${name}`, label: name })), signal),
});

// The record dialog recipe: new (with "save and add another") and edit, one command.
interface Label { id: number; name: string }
const labels = ref<Label[]>([{ id: 1, name: "Hardware" }, { id: 2, name: "Billing" }]);
const label = useRecordDialog({
  defaults: () => ({ name: "" }),
  validator: { safeParse: (input) => ((input as { name: string }).name.trim() === "" ? { success: false, error: { issues: [{ path: ["name"], message: t("forms.options.nameRequired") }] } } : { success: true, data: input as { name: string } }) },
  toValues: (row: Label) => ({ name: row.name }),
  create: async (input) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    labels.value = [...labels.value, { id: Date.now(), name: input.name }];
  },
  update: async (row, input) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    labels.value = labels.value.map((each) => (each.id === row.id ? { ...each, name: input.name } : each));
  },
  done: () => void toast.success(t("forms.options.saved")),
});
</script>

<template>
  <AdaptivePageShell :title="t('forms.options.title')" :description="t('forms.options.intro')" width="content">
    <FormGroup :header="t('forms.options.demo')" :footer="t('forms.options.demoHint', { count: asked })">
      <SegmentedField v-model="delay" :label="t('forms.options.delay')" :options="[{ value: 300, label: '0.3 s' }, { value: 1500, label: '1.5 s' }, { value: 5000, label: '5 s' }]" />
      <SwitchField v-model="failing" :label="t('forms.options.failing')" />
    </FormGroup>

    <FormView :editable="true">
      <FormGroup :header="t('forms.options.vehicle')" :footer="t('forms.options.vehicleHint')">
        <SelectField v-model="values.make" :label="t('forms.options.make')" :options="makes" clearable>
          <template #trailing><Button prominence="primary" size="sm">{{ t("forms.options.save") }}</Button></template>
        </SelectField>
        <SelectField v-model="values.model" :label="t('forms.options.model')" :options="models" :disabled="values.make === null" />
        <MultiSelectField v-model="values.equipment" :label="t('forms.options.equipment')" :options="equipment" :disabled="values.model === null" />
      </FormGroup>
      <FormGroup :header="t('forms.options.numbers')" :footer="t('forms.options.numbersHint')">
        <NumberField v-model="values.year" :label="t('forms.options.year')" :grouping="false" />
        <NumberField v-model="values.latitude" :label="t('forms.options.latitude')" :decimals="7" :min-decimals="0" negative mono :grouping="false" />
        <NumberField v-model="values.longitude" :label="t('forms.options.longitude')" :decimals="7" :min-decimals="0" negative mono :grouping="false" />
        <NumberField v-model="values.sum" :label="t('forms.options.grouped')" />
      </FormGroup>
    </FormView>

    <FormGroup :header="t('forms.options.records')" :footer="t('forms.options.recordsHint')" class="mt-group-gap">
      <div v-for="row in labels" :key="row.id" class="flex items-center justify-between px-row-inset py-1">
        <span class="text-body">{{ row.name }}</span>
        <Button prominence="link" @click="label.edit(row)">{{ t("forms.options.edit") }}</Button>
      </div>
      <div class="px-row-inset py-2"><Button prominence="primary" @click="label.create()">{{ t("forms.options.new") }}</Button></div>
    </FormGroup>

    <CommandDialog :command="label.command" :title="label.editing.value ? t('forms.options.edit') : t('forms.options.new')" :confirm-label="t('forms.options.save')">
      <FormGroup><TextField v-bind="label.form.bind('name')" :label="t('forms.options.name')" required /></FormGroup>
      <template v-if="!label.editing.value" #actions="{ run, busy }">
        <Button :disabled="busy" @click="run({ addAnother: true })">{{ t("forms.options.addAnother") }}</Button>
      </template>
    </CommandDialog>
  </AdaptivePageShell>
</template>
