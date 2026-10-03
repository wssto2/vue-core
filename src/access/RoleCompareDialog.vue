<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { FormGroup, FormRow, SelectField } from "../form";
import { Modal } from "../modal";
import type { Role, RoleComparison, RoleSummary } from "../modules/access/entities";
import { useAccessApi } from "./api";
import { useAccessLabels } from "./labels";

/**
 * *Compare with a predefined role*: what a custom role holds that the other does not, what it lacks, and where the whose
 * differs. The way to see how far a copy has drifted before replacing it.
 */
const props = defineProps<{ role: Role; others: readonly RoleSummary[] }>();

const { t } = useI18n();
const labels = useAccessLabels();
const api = useAccessApi();
const modal = useTemplateRef<{ present: () => void }>("modal");

const chosen = ref<string | null>(null);
const comparison = ref<RoleComparison | null>(null);
const loading = ref(false);
const failed = ref(false);

const options = computed(() => props.others.map((role) => ({ value: role.ref, label: labels.roleName(role) })));
const identical = computed(() => comparison.value !== null && !comparison.value.only_in_role.length && !comparison.value.only_in_other.length && !comparison.value.different.length);

async function compare(ref: string | null) {
  chosen.value = ref;
  comparison.value = null;
  failed.value = false;
  loading.value = false; // an answer still on its way belongs to what was left and will be dropped
  if (!ref) return;
  loading.value = true;
  try {
    const result = await api.compare(props.role.ref, ref);
    if (chosen.value === ref) comparison.value = result;
  } catch {
    if (chosen.value === ref) failed.value = true;
  } finally {
    if (chosen.value === ref) loading.value = false;
  }
}

function present() {
  chosen.value = null;
  comparison.value = null;
  failed.value = false;
  modal.value?.present();
}
defineExpose({ present });
</script>

<template>
  <Modal ref="modal" :title="t('core.access.compare.title')" :subtitle="labels.roleName(props.role)" size="lg" grouped without-footer>
    <div class="flex flex-col gap-group-gap" data-test="role-compare">
      <FormGroup :footer="t('core.access.compare.footer')">
        <SelectField :model-value="chosen" :label="t('core.access.compare.with')" :options="options" @update:model-value="compare($event)" />
      </FormGroup>

      <p v-if="loading" class="px-row-inset text-body text-content-muted" data-test="compare-loading">{{ t("core.access.compare.loading") }}</p>
      <p v-else-if="failed" class="px-row-inset text-body text-content-destructive" role="alert" data-test="compare-failed">{{ t("core.access.compare.failed") }}</p>

      <template v-else-if="comparison">
        <p v-if="identical" class="px-row-inset text-body text-content-muted" data-test="compare-identical">{{ t("core.access.compare.identical") }}</p>

        <FormGroup v-if="comparison.only_in_role.length" :header="t('core.access.compare.only_in_role', { count: comparison.only_in_role.length })">
          <FormRow v-for="grant in comparison.only_in_role" :key="grant.permission" layout="setting" :label="labels.permissionLabel(grant.permission)" />
        </FormGroup>

        <FormGroup v-if="comparison.only_in_other.length" :header="t('core.access.compare.only_in_other', { count: comparison.only_in_other.length })">
          <FormRow v-for="grant in comparison.only_in_other" :key="grant.permission" layout="setting" :label="labels.permissionLabel(grant.permission)" />
        </FormGroup>

        <FormGroup v-if="comparison.different.length" :header="t('core.access.compare.different', { count: comparison.different.length })">
          <FormRow v-for="row in comparison.different" :key="row.permission" layout="setting" :label="labels.permissionLabel(row.permission)"
            :value="t('core.access.compare.whose', { role: labels.qualifierLabel(row.role), other: labels.qualifierLabel(row.other) })" />
        </FormGroup>
      </template>
    </div>
  </Modal>
</template>
