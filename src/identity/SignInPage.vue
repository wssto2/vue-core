<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { Button } from "../button";
import { Panel } from "../content";
import { FormView, TextField } from "../form";
import { returnTo } from "../router";
import { useIdentityContext } from "./context";
import { useSignInForm } from "./useSignInForm";

/**
 * The sign-in page of `identityFeature`: a login and a password. Whatever the server refuses with (a wrong
 * login or password, the lock after too many wrong ones with the time it ends, an inactive account, too many
 * attempts) is said under the password, in the app's language.
 */
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { home } = useIdentityContext();
const { form, passwordError, submit: signInNow } = useSignInForm();

async function submit() {
  if (await signInNow()) await router.push(returnTo(route) ?? home);
}
</script>

<template>
  <div class="flex flex-1 flex-col items-center justify-center gap-8">
    <h1 class="text-xl font-semibold text-content-strong">{{ t("core.identity.signin.title") }}</h1>
    <Panel class="w-full max-w-md">
      <FormView class="p-1" @submit="submit">
        <TextField v-bind="form.bind('login')" :label="t('core.identity.signin.login')" autocomplete="username" required />
        <TextField v-bind="form.bind('password')" :label="t('core.identity.signin.password')" type="password" autocomplete="current-password" required
          :error="passwordError" />
        <Button type="submit" prominence="primary" class="w-full" :processing="form.submitting.value">{{ t("core.identity.signin.submit") }}</Button>
      </FormView>
    </Panel>
  </div>
</template>
