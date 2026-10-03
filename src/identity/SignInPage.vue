<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { Button } from "../button";
import { Panel } from "../content";
import { isApiError } from "../client";
import { FormView, TextField, useForm, type FormValidator } from "../form";
import { useFormat } from "../format";
import { useDescribeError } from "../i18n";
import { usePlatform } from "../platform";
import { returnTo } from "../router";
import { useIdentityContext } from "./context";
import { lockedUntil, signIn } from "./signIn";

/**
 * The sign-in page of `identityFeature`: a login and a password. Whatever the server refuses with (a wrong
 * login or password, the lock after too many wrong ones with the time it ends, an inactive account, too many
 * attempts) is said under the password, in the app's language.
 */
const { t } = useI18n();
const platform = usePlatform();
const route = useRoute();
const router = useRouter();
const format = useFormat();
const describeError = useDescribeError();
const { home } = useIdentityContext();

const required: FormValidator<{ login: string; password: string }> = {
  safeParse(input) {
    const values = input as { login: string; password: string };
    const issues = (["login", "password"] as const).filter((key) => values[key] === "").map((key) => ({ path: [key], message: t("core.identity.signin.required") }));
    return issues.length === 0 ? { success: true, data: values } : { success: false, error: { issues } };
  },
};

const form = useForm({
  defaults: () => ({ login: "", password: "" }),
  validator: required,
  failureMessage(_kind, error) {
    const until = lockedUntil(error);
    if (until) return t("core.errors.identity.signin.locked", { locked_until: format.time(until) });
    return isApiError(error) ? describeError(error) : undefined;
  },
});

async function submit() {
  const result = await form.submit((payload) => signIn(platform, payload));
  if (result.status === "saved") await router.push(returnTo(route) ?? home);
}
</script>

<template>
  <div class="flex flex-1 flex-col items-center justify-center gap-8">
    <h1 class="text-xl font-semibold text-content-strong">{{ t("core.identity.signin.title") }}</h1>
    <Panel class="w-full max-w-md">
      <FormView class="p-1" @submit="submit">
        <TextField v-bind="form.bind('login')" :label="t('core.identity.signin.login')" autocomplete="username" required />
        <TextField v-bind="form.bind('password')" :label="t('core.identity.signin.password')" type="password" autocomplete="current-password" required
          :error="form.errors.first('password') ?? (form.failure.value?.error ? form.failure.value.message : undefined)" />
        <Button type="submit" prominence="primary" class="w-full" :processing="form.submitting.value">{{ t("core.identity.signin.submit") }}</Button>
      </FormView>
    </Panel>
  </div>
</template>
