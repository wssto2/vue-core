<script setup lang="ts">
import { computed, watch } from "vue";
import { isApiError } from "../client";
import { useApplication } from "../app";
import { useDescribeError } from "../i18n";
import { identityRoutes } from "../modules/identity/routes";
import { toast } from "../overlay";
import { usePlatform } from "../platform";
import { isSessionEnded } from "./signIn";

/**
 * Keeps the person's language in step with the server while they are signed in, and renders nothing: the
 * language they saved is applied when the session begins (also after a reload), and a language they choose
 * in the account menu is saved with `change-locale`. A save that fails is said in a toast; the page stays in
 * the language they chose, except when the server does not support it (`identity.locale.unsupported`): that one goes back to the saved language.
 */
const { http, session } = usePlatform();
const application = useApplication();
const describeError = useDescribeError();

const saved = computed(() => {
  const state = session.state.value;
  const locale = state.status === "authenticated" ? (state.user as { locale?: unknown }).locale : undefined;
  return typeof locale === "string" ? locale : null;
});
// What the server knows: the saved language, then whatever was saved since.
let known: string | null = null;

watch(saved, async (locale) => {
  known = locale;
  if (locale !== null && locale !== application.locale.value && application.locales.includes(locale)) await application.setLocale(locale);
}, { immediate: true });

watch(application.locale, async (locale) => {
  if (session.state.value.status !== "authenticated" || locale === known) return;
  try {
    await http.request(identityRoutes.changeLocale, { locale });
    known = locale;
  } catch (error) {
    if (isSessionEnded(error)) return;
    toast.error(describeError(error));
    // The server will not keep this language for the account: go back to the one it knows rather than show one that is lost on reload.
    if (isApiError(error) && error.code === "identity.locale.unsupported" && known !== null) await application.setLocale(known);
  }
});
</script>

<template><span hidden /></template>
