<script setup lang="ts">
import { inject, nextTick } from "vue";
import { Icon } from "../icon";
import { useLeaveGuardContext } from "../form/leaveGuard";
import { useOpenDialogCount } from "../overlay";
import { pageRefreshKey } from "../router/pageRefresh";
import { useMediaQuery } from "../internal/mediaQuery";
import { useNavigationDrawer } from "./drawer";
import { PULL_THRESHOLD, usePullToRefresh } from "./pullToRefresh";

/**
 * The shell's pull to refresh, for an installed application (a browser tab has its own): reloads the page, never the shell.
 * The page outlet remounts (`pageRefreshKey`); the sidebar, the top bar, the drawer and open popovers stay. Unsaved changes
 * ask first. The indicator follows the finger and spins while the page reloads; reduced motion keeps it still.
 */
const standalone = useMediaQuery("(display-mode: standalone)");
const openDialogs = useOpenDialogCount();
const drawer = useNavigationDrawer();
const guard = useLeaveGuardContext();
const page = inject(pageRefreshKey, null);

const { pull, refreshing } = usePullToRefresh(
  async () => {
    if (guard.hasUnsavedChanges() && !(await guard.confirm())) return;
    if (page) page.value++;
    await nextTick();
  },
  {
    enabled: () =>
      page !== null &&
      openDialogs.value === 0 &&
      !drawer?.open.value &&
      (standalone.value || (navigator as Navigator & { standalone?: boolean }).standalone === true),
  },
);
</script>

<template>
  <div v-if="pull > 0 || refreshing" aria-hidden="true" data-shell-pull-to-refresh
    class="pointer-events-none fixed inset-x-0 z-40 flex justify-center"
    :style="{ top: `calc(env(safe-area-inset-top) + ${Math.max(pull, 8)}px)` }">
    <span class="flex size-9 items-center justify-center rounded-full bg-surface-raised text-primary-700 shadow-md ring-1 ring-border-separator dark:text-primary-300">
      <Icon :name="refreshing ? 'loader4Line' : 'refreshLine'" :size="20" :class="refreshing ? 'animate-spin motion-reduce:animate-none' : ''"
        :style="refreshing ? undefined : { transform: `rotate(${(pull / PULL_THRESHOLD) * 270}deg)`, opacity: Math.min(1, pull / PULL_THRESHOLD) }" />
    </span>
  </div>
</template>
