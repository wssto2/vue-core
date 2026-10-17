<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "../../button";
import { CommandDialog, FormGroup, TextField, useCommand, type FormValidator } from "../../form";
import { identityRoutes } from "../../modules/identity/routes";
import type { ChangePasswordInput } from "../../modules/identity/schemas";
import { toast } from "../../overlay";
import { usePlatform } from "../../platform";
import { useServerMessages } from "../../i18n";
import ActionRow from "../shared/ActionRow.vue";

/**
 * Changing one's own password, from a row that opens a dialog: the current one, the new one twice. The server decides what a
 * good password is and says so on the field; a wrong current password lands on its field, and too many wrong ones say when
 * to try again. Every other session of the person ends.
 */
const { t } = useI18n();
const { http } = usePlatform();
const visible = ref(false);

const validator: FormValidator<ChangePasswordInput> = {
  safeParse(input) {
    const draft = input as { current: string; password: string; repeat: string };
    const required = t("core.account.validation.required");
    const issues = [
      ...(draft.current === "" ? [{ path: ["current"], message: required }] : []),
      ...(draft.password === "" ? [{ path: ["password"], message: required }] : []),
      ...(draft.password !== "" && draft.repeat !== draft.password ? [{ path: ["repeat"], message: draft.repeat === "" ? required : t("core.account.validation.mismatch") }] : []),
    ];
    return issues.length > 0
      ? { success: false, error: { issues } }
      : { success: true, data: { current_password: draft.current, new_password: draft.password, new_password_confirmation: draft.repeat } };
  },
};

const command = useCommand({
  ...useServerMessages(),
  defaults: () => ({ current: "", password: "", repeat: "" }),
  validator,
  // The server names its fields; the draft's are shorter.
  serverField: (field) => ({ current_password: "current", new_password: "password", new_password_confirmation: "repeat" })[field] ?? field,
  run: (payload) => http.request(identityRoutes.profileChangePassword, payload),
  done: () => {
    visible.value = false;
    toast.success(t("core.profile.password.changed"));
  },
});
</script>

<template>
  <FormGroup data-profile-password>
    <ActionRow :label="t('core.profile.password.submit')" :sub="t('core.profile.password.row_sub')" data-change-password @click="command.present()" />
  </FormGroup>
  <CommandDialog :command="command" :title="t('core.profile.password.title')" :confirm-label="t('core.profile.password.submit')">
    <FormGroup data-password-dialog>
      <TextField v-bind="command.form.bind('current')" :type="visible ? 'text' : 'password'" :label="t('core.profile.password.current')" required autocomplete="current-password" />
      <TextField v-bind="command.form.bind('password')" :type="visible ? 'text' : 'password'" :label="t('core.profile.password.new')" required autocomplete="new-password" />
      <TextField v-bind="command.form.bind('repeat')" :type="visible ? 'text' : 'password'" :label="t('core.profile.password.repeat')" required autocomplete="new-password" />
    </FormGroup>
    <div class="flex justify-end">
      <Button prominence="link" size="sm" :icon="visible ? 'eyeOff' : 'eye'" v-bind="{ 'aria-pressed': visible }" data-password-visibility @click="visible = !visible">
        {{ visible ? t("core.profile.password.hide") : t("core.profile.password.show") }}
      </Button>
    </div>
  </CommandDialog>
</template>
