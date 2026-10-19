<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRouter, type RouteLocationRaw } from "vue-router";
import { Button } from "../button";
import { Panel } from "../content";
import { Icon } from "../icon";

/**
 * What a page the person may not open shows in its place: a lock, the sentence of `core.no_access`, whom to write to (the `contact`
 * address, when the application has one) and a way back. Use it for `createApplication({ noAccess })`, which renders a component
 * without props: `noAccess: () => h(RestrictedPanel, { contact: "access@example.com" })`.
 *
 * Back goes one step in the application's own history; a page opened directly (a bookmark, a shared link) has none, and going
 * back there would leave the application, so it goes to `home` instead.
 */
const props = withDefaults(defineProps<{
  /** An e-mail address to write to for access, shown as a link. */
  contact?: string;
  /** Where back goes when the application's history has no previous page. Default `/`. */
  home?: RouteLocationRaw;
}>(), { contact: undefined, home: "/" });

const router = useRouter();
const { t } = useI18n();

function goBack() {
  if ((window.history.state as { back?: string | null } | null)?.back) router.back();
  else void router.push(props.home);
}
</script>

<template>
  <Panel>
    <div data-test="restricted-panel" class="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <Icon name="lockLine" :size="32" class="mb-6 size-12 text-status-danger-content" />
      <h2 class="mb-2 text-lg font-semibold text-content-strong">{{ t("core.no_access.title") }}</h2>
      <p class="max-w-prose text-subheadline text-content-muted" :class="props.contact ? 'mb-1' : 'mb-6'">{{ t("core.no_access.body") }}</p>
      <p v-if="props.contact" class="mb-6 text-subheadline text-content-muted">
        {{ t("core.no_access.contact") }}
        <a :href="`mailto:${props.contact}`" class="text-content-link hover:underline">{{ props.contact }}</a>.
      </p>
      <Button size="sm" icon="arrowLeftSLine" @click="goBack">{{ t("core.no_access.back") }}</Button>
    </div>
  </Panel>
</template>
