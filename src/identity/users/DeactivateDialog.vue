<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { IconTile } from "../../controls";
import { CommandDialog, FormGroup, FormRow, useCommand } from "../../form";
import { identityRoutes } from "../../modules/identity/routes";
import { toast } from "../../overlay";
import { usePlatform } from "../../platform";
import { useServerMessages } from "../fieldMessages";

/**
 * "Deactivate": says what it does (signed out on every device now, cannot sign in, roles and history kept) and asks once.
 * When the application's deactivation hook refuses (the person still owns something), the dialog stays open and says the
 * reason in words above the consequences.
 */
const props = defineProps<{ id: number; name: string; sessionCount: number | null }>();
const emit = defineEmits<{ done: [] }>();

const { t } = useI18n();
const { http } = usePlatform();

const command = useCommand({
  ...useServerMessages(),
  defaults: () => ({}),
  run: () => http.request(identityRoutes.usersDeactivate, { id: props.id }),
  done: () => {
    toast.success(t("core.users.deactivate.done", { name: props.name }));
    emit("done");
  },
});

defineExpose({ open: () => command.present() });
</script>

<template>
  <CommandDialog :command="command" :title="t('core.users.deactivate.title')" :subtitle="props.name" :confirm-label="t('core.users.actions.deactivate_short')"
    :busy-label="t('core.users.deactivate.busy')" :done-label="t('core.users.deactivate.done_label')" size="md">
    <FormGroup data-deactivate-dialog>
      <FormRow layout="setting" :label="t('core.users.deactivate.signs_out', { n: props.sessionCount ?? 0 })" :sub="t('core.users.deactivate.signs_out_sub')">
        <template #leading><IconTile tone="anchor" icon="logoutBoxRLine" /></template>
      </FormRow>
      <FormRow layout="setting" :label="t('core.users.deactivate.cannot_sign_in')" :sub="t('core.users.deactivate.cannot_sign_in_sub')">
        <template #leading><IconTile tone="anchor" icon="lockLine" /></template>
      </FormRow>
    </FormGroup>
  </CommandDialog>
</template>
