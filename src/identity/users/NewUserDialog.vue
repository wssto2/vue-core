<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useApplication } from "../../app";
import { identityRoutes } from "../../modules/identity/routes";
import type { UserDetail } from "../../modules/identity/entities";
import type { CreateUserInput } from "../../modules/identity/schemas";
import { CommandDialog, FormGroup, SelectField, TextField, useCommand, type FormValidator, type ValidationIssue } from "../../form";
import { toast } from "../../overlay";
import { usePlatform } from "../../platform";
import { languageName } from "../../internal/languageName";
import { useServerMessages } from "../fieldMessages";

/**
 * "New user": a login, a name, an e-mail, a language and a password (typed twice, so a slip is caught before the person
 * is told it). The server's refusals land on the fields (a login or an e-mail already taken, a weak password); saving
 * opens the new person's record.
 */
const { t } = useI18n();
const { http } = usePlatform();
const application = useApplication();
const messages = useServerMessages();

const languages = computed(() => application.locales.map((code) => ({ value: code, label: languageName(code) })));
const defaults = () => ({ login: "", name: "", email: "", phone: "", locale: application.locale.value as string | null, password: "", repeat: "" });

const blank = (value: string) => value.trim() === "";

const validator: FormValidator<CreateUserInput> = {
  safeParse(input) {
    const { repeat, locale, ...values } = input as ReturnType<typeof defaults>;
    const required = t("core.account.validation.required");
    const issues: ValidationIssue[] = (["login", "name", "email", "password"] as const)
      .filter((field) => blank(values[field]))
      .map((field) => ({ path: [field], message: required }));
    if (locale === null) issues.push({ path: ["locale"], message: required });
    if (!blank(values.password) && repeat !== values.password) issues.push({ path: ["repeat"], message: blank(repeat) ? required : t("core.account.validation.mismatch") });
    return issues.length > 0 ? { success: false, error: { issues } } : { success: true, data: { ...values, locale: locale ?? "", phone: blank(values.phone) ? undefined : values.phone } };
  },
};

const emit = defineEmits<{ created: [user: UserDetail] }>();

const command = useCommand({
  ...messages,
  defaults,
  validator,
  run: async (input) => (await http.request(identityRoutes.usersCreate, input)).data,
  done: (user) => {
    toast.success(t("core.users.create.done", { name: user.name }));
    emit("created", user);
  },
});

defineExpose({ create: () => command.present() });
</script>

<template>
  <CommandDialog :command="command" :title="t('core.users.create.title')" :subtitle="t('core.users.create.subtitle')" :confirm-label="t('core.users.create.action')" size="md">
    <FormGroup label-width="11rem">
      <TextField v-bind="command.form.bind('name')" :label="t('core.users.fields.name')" required autocomplete="off" />
      <TextField v-bind="command.form.bind('login')" :label="t('core.users.fields.login')" required mono autocomplete="off" />
      <TextField v-bind="command.form.bind('password')" :label="t('core.users.fields.password')" type="password" required autocomplete="new-password" />
      <TextField v-bind="command.form.bind('repeat')" :label="t('core.users.fields.password_repeat')" type="password" required autocomplete="new-password" />
      <TextField v-bind="command.form.bind('email')" :label="t('core.users.fields.email')" type="email" required autocomplete="off" />
      <TextField v-bind="command.form.bind('phone')" :label="t('core.users.fields.phone')" type="tel" autocomplete="off" />
      <SelectField v-bind="command.form.bind('locale')" :label="t('core.users.fields.locale')" :options="languages" required />
    </FormGroup>
  </CommandDialog>
</template>
