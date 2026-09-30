<script setup lang="ts">
import { EditorPage, useForm } from "@wssto2/vue-core/form";
import { useFormat } from "@wssto2/vue-core/format";
import { toast } from "@wssto2/vue-core/overlay";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { api } from "../api";
import OfferSections from "../components/OfferSections.vue";
import { emptyOffer, offerBody, offerTotals, offerValidator } from "../offer";
import { camel } from "../validate";
import { formsRoutes } from "../routes";

// A long create form: the page around it is `EditorPage`; the form is a feature-local `useForm`; the totals are derived here from the draft.
const { t } = useI18n();
const router = useRouter();
const format = useFormat();

const form = useForm({
  defaults: emptyOffer,
  validator: offerValidator({
    required: t("forms.required"),
    customer: t("forms.offer.chooseCustomer"),
    channel: t("forms.offer.chooseChannel"),
    quantity: t("forms.offer.quantityMin"),
    price: t("forms.offer.priceMin"),
    noLines: t("forms.offer.noLines"),
  }),
  serverField: camel,
});

const totals = computed(() => offerTotals(form.values));
const fieldLabel = (field: string) => t(`forms.offer.fields.${field.split(".")[0]}`, field);

async function save() {
  const result = await form.submit((payload, { idempotencyKey }) => {
    void idempotencyKey; // a real client sends it as the `Idempotency-Key` header
    return api.createOffer(offerBody(payload));
  });
  if (result.status === "saved") {
    toast.success(t("forms.offer.created"));
    await router.push(formsRoutes.index);
  }
}
</script>

<template>
  <EditorPage :title="t('forms.newOffer')" :back="{ label: t('forms.accounts'), to: formsRoutes.index }" :form="form" :save-label="t('forms.offer.create')" :field-label="fieldLabel" @save="save" @cancel="router.push(formsRoutes.index)">
    <OfferSections :form="form" />
    <template #aside>
      <dl class="mx-2.5 flex flex-col gap-1 border-t border-border-separator pt-3.5 text-footnote">
        <div class="flex justify-between"><dt class="text-content-muted">{{ t("forms.offer.net") }}</dt><dd class="tabular-nums">{{ format.money(totals.net, "EUR") }}</dd></div>
        <div class="flex justify-between"><dt class="text-content-muted">{{ t("forms.offer.vat") }}</dt><dd class="tabular-nums">{{ format.money(totals.vat, "EUR") }}</dd></div>
        <div class="flex justify-between text-body font-semibold"><dt>{{ t("forms.offer.total") }}</dt><dd class="tabular-nums">{{ format.money(totals.total, "EUR") }}</dd></div>
      </dl>
    </template>
  </EditorPage>
</template>
