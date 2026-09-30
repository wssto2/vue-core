<script setup lang="ts">
import {
  ChoiceChips, ComboField, DateField, fieldKey, FormGroup, MoneyField, NumberField, SegmentedField, SwitchField, TextareaField, TextField, type Form, type SelectOption,
} from "@wssto2/vue-core/form";
import { Button } from "@wssto2/vue-core/button";
import { SectionPanel } from "@wssto2/vue-core/page";
import { useI18n } from "vue-i18n";
import { api } from "../api";
import { emptyLine, type OfferInput, type OfferValues } from "../offer";

// The offer's field markup: the editor page registers nothing for it, the fields mark themselves (errors, required) and the sections register
// with the page, so its section list and progress follow without a line here.
const props = defineProps<{ form: Form<OfferValues, OfferInput> }>();
const { t } = useI18n();

const channels: readonly SelectOption<"email" | "phone">[] = [
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Phone" },
];
const extras: readonly SelectOption<string>[] = [
  { value: "delivery", label: t("forms.offer.extras.delivery") },
  { value: "insurance", label: t("forms.offer.extras.insurance") },
  { value: "installation", label: t("forms.offer.extras.installation") },
];

// The customer is searched on the server as the user types; the field does no request itself.
const findCustomers = (query: string, { signal }: { signal: AbortSignal }) =>
  api.customers(query, signal).then((found) => found.map((customer): SelectOption<number> => ({ value: customer.id, label: customer.name, description: customer.city })));

const bind = props.form.bind;
const addLine = () => props.form.values.lines.push(emptyLine());
const removeLine = (index: number) => props.form.values.lines.splice(index, 1);
const error = (path: string) => props.form.errors.first(path);
</script>

<template>
  <SectionPanel :title="t('forms.offer.sections.customer')" number="01" presentation="section">
    <FormGroup>
      <ComboField v-bind="bind('customerId')" :label="t('forms.offer.customer')" :search="findCustomers" :placeholder="t('forms.offer.customerPlaceholder')" required width="lg" />
      <DateField v-bind="bind('deliveryOn')" :label="t('forms.offer.deliveryOn')" />
      <SegmentedField v-bind="bind('channel')" :label="t('forms.offer.channel')" :options="channels" required />
    </FormGroup>
  </SectionPanel>

  <SectionPanel :title="t('forms.offer.sections.lines')" number="02" presentation="section">
    <div class="flex flex-col gap-group-gap">
      <FormGroup v-for="(line, index) in props.form.values.lines" :key="index" :header="t('forms.offer.line', { n: index + 1 })">
        <!-- Lines are a list inside the draft: their fields edit `line.x` with v-model and take their message from the dotted path the server or the schema used. -->
        <TextField v-model="line.product" :label="t('forms.offer.product')" :error="error(`lines.${index}.product`)" v-bind="fieldKey(`lines.${index}.product`)" required />
        <NumberField v-model="line.quantity" :label="t('forms.offer.quantity')" :error="error(`lines.${index}.quantity`)" v-bind="fieldKey(`lines.${index}.quantity`)" required />
        <MoneyField v-model="line.unitPrice" currency="EUR" :label="t('forms.offer.unitPrice')" :error="error(`lines.${index}.unitPrice`)" v-bind="fieldKey(`lines.${index}.unitPrice`)" required />
        <template #header-trailing>
          <Button v-if="props.form.values.lines.length > 1" prominence="plain" tone="critical" size="sm" @click="removeLine(index)">{{ t("forms.offer.removeLine") }}</Button>
        </template>
      </FormGroup>
      <p v-if="error('lines')" role="alert" class="text-footnote text-content-destructive">{{ error("lines") }}</p>
      <Button class="self-start" @click="addLine">{{ t("forms.offer.addLine") }}</Button>
    </div>
  </SectionPanel>

  <SectionPanel :title="t('forms.offer.sections.options')" number="03" presentation="section">
    <FormGroup>
      <SwitchField v-bind="bind('urgent')" :label="t('forms.offer.urgent')" :hint="t('forms.offer.urgentHint')" />
      <ChoiceChips v-bind="bind('extras')" :label="t('forms.offer.extrasLabel')" :options="extras" />
      <TextareaField v-bind="bind('note')" :label="t('forms.offer.note')" :max-length="300" stacked />
    </FormGroup>
  </SectionPanel>
</template>
