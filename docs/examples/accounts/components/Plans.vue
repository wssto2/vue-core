<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Panel } from "@wssto2/vue-core/content";
import { usePlatform } from "@wssto2/vue-core/platform";
import { AsyncSection, useLoad } from "@wssto2/vue-core/state";

interface Plan {
  readonly id: number;
  readonly name: string;
}

const { t } = useI18n();
const { http } = usePlatform();

// A region with nothing to be identified by (a list, a page's settings): one load, latest wins, and the state
// is the same AsyncState the frame takes. `reload()` keeps the rows on screen while it runs; `plans.update(rows)`
// puts in what a save returned and drops any load still on its way.
const plans = useLoad(({ signal }) => http.get<Plan[]>("/plans", { signal }).then((result) => result.data));
</script>

<template>
  <Panel :title="t('accounts.plans')">
    <AsyncSection :state="plans.state.value" @retry="plans.reload()">
      <template #default="{ value }">
        <ul class="flex flex-col gap-2">
          <li v-for="plan in value" :key="plan.id">{{ plan.name }}</li>
        </ul>
      </template>
    </AsyncSection>
  </Panel>
</template>
