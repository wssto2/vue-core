<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { CommandDialog, FormGroup, SelectField, useCommand, type FormValidator } from "../form";
import type { Role, RoleSummary } from "../modules/access/entities";
import { toast } from "../overlay";
import { useAccessApi } from "./api";
import { useAccessLabels } from "./labels";
import { useRefusalMessage } from "./refusals";

/**
 * *Replace*: every holder of a custom role gets a predefined role at the same place instead. It goes through the same rules as
 * giving a role, so it can be refused (you cannot give more than you hold); either every holder moves or none does.
 */
const props = defineProps<{ role: Role; others: readonly RoleSummary[] }>();
const emit = defineEmits<{ replaced: [rebound: number] }>();

const { t } = useI18n();
const labels = useAccessLabels();
const api = useAccessApi();

interface Draft {
  with: string | null;
}
const validator: FormValidator<{ with: string }> = {
  safeParse: (input) => ((input as Draft).with ? { success: true, data: { with: (input as Draft).with as string } } : { success: false, error: { issues: [{ path: ["with"], message: t("core.access.replace.choose") }] } }),
};

const replace = useCommand<Draft, { with: string }, number>({
  defaults: () => ({ with: null }),
  validator,
  failureMessage: useRefusalMessage(),
  run: (input) => api.replace(props.role.ref, input.with),
  done: (rebound) => {
    toast.success(t("core.access.replace.done", { count: rebound }));
    emit("replaced", rebound);
  },
});

const options = computed(() => props.others.map((role) => ({ value: role.ref, label: labels.roleName(role) })));
defineExpose({ present: () => replace.present() });
</script>

<template>
  <CommandDialog :command="replace" :title="t('core.access.replace.title')" :subtitle="labels.roleName(props.role)" size="md" :confirm-label="t('core.access.replace.confirm')"
    :message="t('core.access.replace.moves', { count: props.role.holders })">
    <div data-test="role-replace">
      <FormGroup :footer="t('core.access.replace.footer')">
        <SelectField v-bind="replace.form.bind('with')" :label="t('core.access.replace.with')" :options="options" />
      </FormGroup>
    </div>
  </CommandDialog>
</template>
