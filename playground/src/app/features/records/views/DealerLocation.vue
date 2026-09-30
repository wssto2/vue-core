<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { Panel } from "@wssto2/vue-core/content";

// A page inside the Locations section (`meta.sectionParent`): the section stays active, the page gets a back to it.
const { t } = useI18n();
const route = useRoute();
</script>

<template>
  <Panel :title="t('records.location', { id: route.params.locationID })">
    <RouterLink :to="{ name: 'records.dealer.locations', params: { dealerID: route.params.dealerID } }" class="text-content-link">{{ t("records.backToLocations") }}</RouterLink>
  </Panel>
</template>
