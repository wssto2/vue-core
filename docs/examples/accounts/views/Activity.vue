<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Panel } from "@wssto2/vue-core/content";
import { useResource, useRouteResourceContext } from "@wssto2/vue-core/resource";
import { AsyncSection } from "@wssto2/vue-core/state";
import { ACCOUNT, useAccountsApi } from "../context";

const { t } = useI18n();
const api = useAccountsApi();
const account = useRouteResourceContext(ACCOUNT);

// A region with a read of its own, depending on the record: it waits until the account is loaded (a missing
// account is one not-found state, not one per region), loads with its id, and retries on its own.
const activity = useResource({ for: account, load: (id, { signal }) => api.activity(id, signal) });
</script>

<template>
  <Panel :title="t('accounts.sections.activity')">
    <AsyncSection :state="activity.state.value" :empty-title="t('accounts.activity.empty')" @retry="activity.reload()">
      <template #default="{ value }">
        <ul class="flex flex-col gap-2">
          <li v-for="entry in value" :key="entry.id">{{ entry.text }}</li>
        </ul>
      </template>
    </AsyncSection>
  </Panel>
</template>
