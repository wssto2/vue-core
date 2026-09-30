<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Panel } from "@wssto2/vue-core/content";
import { useResource, useRouteResourceContext } from "@wssto2/vue-core/resource";
import { AsyncSection } from "@wssto2/vue-core/state";
import { api } from "../api";
import { DEALER_RESOURCE } from "../context";

// A region that loads on its own, for the identity of the page's record.
const { t } = useI18n();
const dealer = useRouteResourceContext(DEALER_RESOURCE);
const locations = useResource({ for: () => dealer.id.value, load: (id, { signal }) => api.dealers.locations(id, { signal }) });
const dealerID = computed(() => dealer.id.value ?? 0);
</script>

<template>
  <Panel :title="t('records.sections.locations')" flush>
    <AsyncSection :state="locations.state.value" @retry="locations.reload()">
      <template #default="{ value }">
        <ul class="divide-y divide-border-separator">
          <li v-for="location in value" :key="location.id">
            <RouterLink :to="{ name: 'records.dealer.location', params: { dealerID, locationID: location.id } }" class="block px-4 py-3 text-content-link hover:bg-fill">{{ location.name }}</RouterLink>
          </li>
        </ul>
      </template>
    </AsyncSection>
  </Panel>
</template>
