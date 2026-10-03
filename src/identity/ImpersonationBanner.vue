<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watchEffect } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { Icon } from "../icon";
import { useDescribeError } from "../i18n";
import { toast } from "../overlay";
import { heldSession, usePlatform } from "../platform";
import { useIdentityContext } from "./context";
import { isSessionEnded, returnToOwnAccount } from "./signIn";

/**
 * The strip across the top while somebody is signed in as another person, with the one way out: "Return to my
 * account". It is not dismissible, and shows only while the session says who the real person is.
 */
const { t } = useI18n();
const platform = usePlatform();
const router = useRouter();
const { home } = useIdentityContext();
const describeError = useDescribeError();

const impersonator = computed(() => heldSession(platform.session.state.value)?.impersonator ?? null);
const name = computed(() => {
  const user = heldSession(platform.session.state.value)?.user as { name?: unknown; login?: unknown; id: number | string } | undefined;
  return typeof user?.name === "string" ? user.name : typeof user?.login === "string" ? user.login : String(user?.id ?? "");
});
const returning = ref(false);

// The shell's sidebar gives the banner's height back to the window (`--shell-banner-h`).
const strip = useTemplateRef<HTMLElement>("strip");
let observer: ResizeObserver | null = null;
watchEffect(() => {
  observer?.disconnect();
  observer = null;
  const element = strip.value;
  if (!element) return void document.documentElement.style.removeProperty("--shell-banner-h");
  if (typeof ResizeObserver === "undefined") return;
  const publish = () => document.documentElement.style.setProperty("--shell-banner-h", `${element.offsetHeight}px`);
  observer = new ResizeObserver(publish);
  observer.observe(element);
  publish();
}, { flush: "post" });
onBeforeUnmount(() => {
  observer?.disconnect();
  document.documentElement.style.removeProperty("--shell-banner-h");
});

async function leave() {
  returning.value = true;
  try {
    await returnToOwnAccount(platform);
    await router.push(home); // what was on screen belonged to the other person
  } catch (error) {
    if (!isSessionEnded(error)) toast.error(describeError(error));
    void platform.session.refresh(); // the banner may be stale (the impersonation ended elsewhere)
  } finally {
    returning.value = false;
  }
}
</script>

<template>
  <div v-if="impersonator" ref="strip" role="status" data-impersonation-banner
    class="sticky top-0 z-40 flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-status-warning-surface px-4 py-2 text-subheadline text-status-warning-content shadow-[inset_0_-1px_0_rgb(154_74_7/0.25)]">
    <Icon name="informationLine" :size="18" class="shrink-0 compact:hidden" />
    <span class="min-w-0 flex-1">
      <span class="hidden md:inline">{{ t("core.identity.impersonation.banner", { name }) }}</span>
      <span class="md:hidden">{{ t("core.identity.impersonation.banner_short", { name }) }}</span>
    </span>
    <button type="button" :disabled="returning"
      class="hit-target cursor-pointer rounded-control bg-status-warning-solid px-3 py-1 text-footnote font-semibold whitespace-nowrap text-white transition duration-motion-fast hover:brightness-110 disabled:opacity-45"
      @click="leave">
      {{ t("core.identity.impersonation.return") }}
    </button>
  </div>
</template>
