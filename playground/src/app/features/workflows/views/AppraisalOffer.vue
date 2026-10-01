<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { Panel } from "@wssto2/vue-core/content";
import { useI18n } from "vue-i18n";
import { appraisal } from "../data";

const { t } = useI18n();
</script>

<template>
  <Panel :title="t('workflows.appraisal.offer')">
    <p class="text-body">{{ appraisal.offer === null ? t("workflows.appraisal.noOffer") : t("workflows.appraisal.offerText", { value: appraisal.offer }) }}</p>
    <template #footer>
      <Button prominence="secondary" @click="appraisal.offer = appraisal.offer === null ? 11800 : null">{{ appraisal.offer === null ? t("workflows.appraisal.makeOffer") : t("workflows.appraisal.clear") }}</Button>
    </template>
  </Panel>
</template>
