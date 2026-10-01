<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { Panel } from "@wssto2/vue-core/content";
import { useI18n } from "vue-i18n";
import { appraisal } from "../data";

const { t } = useI18n();
</script>

<template>
  <Panel :title="t('workflows.appraisal.valuation')">
    <p class="text-body">{{ appraisal.valuation === null ? t("workflows.appraisal.noValuation") : t("workflows.appraisal.valuationText", { value: appraisal.valuation }) }}</p>
    <template #footer>
      <Button prominence="secondary" @click="appraisal.valuation = appraisal.valuation === null ? 12400 : null">{{ appraisal.valuation === null ? t("workflows.appraisal.value") : t("workflows.appraisal.clear") }}</Button>
    </template>
  </Panel>
</template>
