<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import type { RouteLocationRaw } from "vue-router";
import { ShellOutlet } from "../app/contributions";
import LeaveGuardRoot from "../form/LeaveGuardRoot.vue";
import { Toaster } from "../overlay";
import { BottomDock, usePageChromeContext } from "../page";
import { usePlatform } from "../platform/platform";
import { heldSession, type SessionUser } from "../platform/session";
import { AppRouterView } from "../router";
import AccountSheet from "./AccountSheet.vue";
import NavigationDrawer from "./NavigationDrawer.vue";
import ShellSidebar from "./ShellSidebar.vue";
import ShellStage from "./ShellStage.vue";
import ShellTopBar from "./ShellTopBar.vue";
import { useShellIdentity, type ShellIdentity } from "./identity";
import type { NavigationProgress } from "./progress";

/**
 * The layout of a backoffice application: a sidebar with the server's menu on desktop, a top bar
 * and a push navigation drawer on phones, the page in between, the bottom dock and the toasts, and
 * the places features contribute to (`headerActions`, `accountMenu`, `banner`, `host`). Give it to
 * `createApplication` through `backofficeShell()`, or render it inside a shell of your own.
 *
 * Signed out (the login page) there is only the top bar with the brand and the page.
 *
 *   <BackofficeShell :identity="(user: Employee) => ({ name: user.fullName })">
 *     <template #brand="{ tone }"><MyLogo :tone="tone" /></template>
 *   </BackofficeShell>
 */
const props = withDefaults(defineProps<{
  /** Where the brand links to. Default `/`. */
  home?: RouteLocationRaw;
  /** Who is signed in, as the account menu shows them. Default: the user's `name` and `email`, else their id. */
  identity?: (user: SessionUser) => ShellIdentity;
  /** The page-load indicator (`backofficeShell()` supplies it to the router as well). */
  progress?: NavigationProgress;
}>(), { home: undefined, identity: undefined, progress: undefined });

defineSlots<{
  /** The logo, for the dark sidebar (`tone` `light`) and the light surfaces (`brand`). Default: the application's name. */
  brand?: (scope: { tone: "light" | "brand" }) => unknown;
  /** Above the account block of the sidebar and of the drawer. */
  footer?: () => unknown;
  /** Extra content at the end of the top bar. */
  "top-bar-end"?: () => unknown;
}>();

const { t } = useI18n();
const { session } = usePlatform();
const chrome = usePageChromeContext();
const identity = useShellIdentity(props.identity);

const authenticated = computed(() => heldSession(session.state.value) !== null);
const accountSheet = useTemplateRef("accountSheet");
</script>

<template>
  <div class="flex min-h-screen flex-col bg-surface-page text-base text-content antialiased">
    <!-- Navigation activity: a thin brand bar pinned to the top edge. -->
    <div v-if="progress?.visible.value" role="progressbar" :aria-label="t('core.state.loading')" data-shell-progress
      class="fixed inset-x-0 top-0 z-10000 flex h-1 justify-center bg-primary-800">
      <div class="animate-grow-and-shrink-width bg-primary-600 motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-60"></div>
    </div>

    <ShellOutlet name="banner" />

    <ShellStage :enabled="authenticated">
      <template v-if="identity" #drawer="{ select, dismiss }">
        <NavigationDrawer :identity="identity" :home="home" @select="select" @account="dismiss(() => accountSheet?.present())">
          <template v-if="$slots.brand" #brand="scope"><slot name="brand" v-bind="scope" /></template>
          <template v-if="$slots.footer" #footer><slot name="footer" /></template>
        </NavigationDrawer>
      </template>

      <ShellTopBar :home="home">
        <template v-if="$slots.brand" #brand="scope"><slot name="brand" v-bind="scope" /></template>
        <template v-if="$slots['top-bar-end']" #end><slot name="top-bar-end" /></template>
      </ShellTopBar>

      <div class="flex flex-1">
        <ShellSidebar v-if="identity" :identity="identity" :home="home">
          <template v-if="$slots.brand" #brand="scope"><slot name="brand" v-bind="scope" /></template>
          <template v-if="$slots.footer" #footer><slot name="footer" /></template>
        </ShellSidebar>
        <!-- overflow-x-clip, not -hidden: hidden makes this a scroll container, which silently disables position: sticky for every page inside it.
             min-w-0: a flex item defaults to min-width:auto, so a wide table would stretch the whole page past the viewport instead of scrolling in its card. -->
        <div class="flex min-w-0 flex-1 overflow-x-clip">
          <main class="flex min-w-0 flex-1 flex-col" :class="chrome.hasShell.value ? '' : 'p-4 md:px-8 md:py-6'"
            :style="chrome.hasShell.value ? undefined : { paddingBottom: 'calc(var(--bottom-dock-h, 0px) + 1rem)' }">
            <AppRouterView />
          </main>
        </div>
      </div>

      <BottomDock :class="authenticated ? 'md:left-64' : ''" />
    </ShellStage>

    <AccountSheet v-if="identity" ref="accountSheet" :identity="identity" />

    <!-- Toasts live outside the app subtree so an open dialog, which marks the rest of the page inert, cannot swallow error feedback or hide it from assistive technology. -->
    <Teleport to="body">
      <div data-dialog-inert-skip><Toaster /></div>
    </Teleport>

    <!-- The one "Discard changes?" question of the application (forms and sheets with unsaved changes ask it). -->
    <LeaveGuardRoot />

    <ShellOutlet name="host" />
  </div>
</template>
