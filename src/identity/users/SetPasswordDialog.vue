<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { CommandDialog, FormGroup, TextField, useCommand, type FormValidator } from "../../form";
import type { SetPasswordInput } from "../../modules/identity/schemas";
import { identityRoutes } from "../../modules/identity/routes";
import { toast } from "../../overlay";
import { usePlatform } from "../../platform";
import { useServerMessages } from "../fieldMessages";

/**
 * "Set a new password": a password typed twice. Nobody can read a password, only replace it, and replacing it signs the
 * person out everywhere and lifts their lock, which the dialog says before it is saved.
 */
const props = defineProps<{ id: number; name: string }>();
const emit = defineEmits<{ saved: [] }>();

const { t } = useI18n();
const { http } = usePlatform();

const validator: FormValidator<Pick<SetPasswordInput, "password">> = {
  safeParse(input) {
    const { password, repeat } = input as { password: string; repeat: string };
    const issues = [
      ...(password === "" ? [{ path: ["password"], message: t("core.account.validation.required") }] : []),
      ...(password !== "" && repeat !== password ? [{ path: ["repeat"], message: repeat === "" ? t("core.account.validation.required") : t("core.account.validation.mismatch") }] : []),
    ];
    return issues.length > 0 ? { success: false, error: { issues } } : { success: true, data: { password } };
  },
};

const command = useCommand({
  ...useServerMessages(),
  defaults: () => ({ password: "", repeat: "" }),
  validator,
  run: (input) => http.request(identityRoutes.usersSetPassword, { id: props.id, password: input.password }),
  done: () => {
    toast.success(t("core.users.password.done", { name: props.name }));
    emit("saved");
  },
});

defineExpose({ open: () => command.present() });
</script>

<template>
  <CommandDialog :command="command" :title="t('core.users.password.title')" :subtitle="props.name" :confirm-label="t('core.users.password.action')">
    <FormGroup :footer="t('core.users.password.footer')" data-set-password-dialog>
      <TextField v-bind="command.form.bind('password')" :label="t('core.users.fields.password')" type="password" required autocomplete="new-password" />
      <TextField v-bind="command.form.bind('repeat')" :label="t('core.users.fields.password_repeat')" type="password" required autocomplete="new-password" />
    </FormGroup>
  </CommandDialog>
</template>
