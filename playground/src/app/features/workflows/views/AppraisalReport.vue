<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { SectionPanel } from "@wssto2/vue-core/page";
import { useI18n } from "vue-i18n";
import { appraisal } from "../data";

// A long step: its own sections list beside it on wide screens (and in the floating jumper on phones).
const { t } = useI18n();
</script>

<template>
  <div class="flex min-w-0 flex-col gap-section-gap">
    <SectionPanel :title="t('workflows.appraisal.condition')" number="01"><p>{{ t("workflows.appraisal.conditionText") }}</p></SectionPanel>
    <SectionPanel :title="t('workflows.appraisal.photosSection')" number="02">
      <p>{{ t("workflows.appraisal.photosText", { n: appraisal.photos }) }}</p>
    </SectionPanel>
    <SectionPanel :title="t('workflows.appraisal.market')" number="03">
      <p>{{ appraisal.marketComparison ? t("workflows.appraisal.marketDone") : t("workflows.appraisal.reportMissing") }}</p>
      <template #footer>
        <Button prominence="secondary" @click="appraisal.marketComparison = !appraisal.marketComparison">{{ appraisal.marketComparison ? t("workflows.appraisal.clear") : t("workflows.appraisal.attach") }}</Button>
      </template>
    </SectionPanel>
  </div>
</template>
