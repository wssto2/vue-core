<script setup lang="ts">
import { provide } from "vue";
import { useMediaQuery } from "../internal/mediaQuery";
import type { RouteLocationRaw } from "vue-router";
import { ShellOutlet } from "../app/contributions";
import AccountMenu from "./AccountMenu.vue";
import NavigationList from "./NavigationList.vue";
import { useHasSearch } from "./search";
import ShellBrand from "./ShellBrand.vue";
import { headerSurfaceKey } from "./accountMenu";
import type { ShellIdentity } from "./identity";

/**
 * The desktop sidebar: an attached, full-height dark rail, the page's one dark surface (the
 * `anchor` palette), sticky and scrolling on its own when the menu is taller than the window. From
 * top to bottom: the brand (home) with the shell's `headerActions`, the shell's `search` field,
 * the server's menu, a `footer`
 * slot, and the account block. It renders from the md breakpoint up and nothing below it (phones use
 * the navigation drawer), so a header action contributed to the shell is mounted once, never in both.
 *
 *   <ShellSidebar :identity="identity" :home="{ name: 'home' }"><template #footer>…</template></ShellSidebar>
 */
defineProps<{ identity: ShellIdentity; home?: RouteLocationRaw }>();

defineSlots<{
  /** The logo, drawn on the dark rail (`tone` is `light`). */
  brand?: (scope: { tone: "light" | "brand" }) => unknown;
  /** Between the menu and the account block: a version note, a support link. */
  footer?: () => unknown;
}>();

provide(headerSurfaceKey, "rail");

const wide = useMediaQuery("(min-width: 48rem)");
const hasSearch = useHasSearch();
</script>

<template>
  <aside v-if="wide" data-shell-sidebar class="flex w-64 shrink-0 flex-col bg-anchor-900 dark:border-r dark:border-white/5 dark:bg-anchor-950">
    <!-- A banner above the shell is sticky and publishes its height as `--shell-banner-h`; everything sticky below it starts under it (the sidebar also gives the height back, so the account menu stays in view). -->
    <!-- z-30: above the page toolbar (z-20), so a popover opened from the rail (the notification inbox) is not painted under the page. -->
    <div class="sticky top-[var(--shell-banner-h,0px)] z-30 flex h-[calc(100vh-var(--shell-banner-h,0px))] flex-col">
      <div class="flex items-center justify-between gap-2 pt-5 pr-2 pb-3 pl-4">
        <ShellBrand :to="home" tone="light" class="min-w-0">
          <template v-if="$slots.brand" #default="scope"><slot name="brand" v-bind="scope" /></template>
        </ShellBrand>
        <div class="flex shrink-0 items-center gap-1"><ShellOutlet name="headerActions" /></div>
      </div>

      <div v-if="hasSearch" class="px-2 pb-1"><ShellOutlet name="search" /></div>

      <!-- Items fade out at the edges instead of being cut off under the logo. -->
      <NavigationList appearance="rail"
        class="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-2 pt-3 pb-3 [mask-image:linear-gradient(to_bottom,transparent,black_12px,black_calc(100%-12px),transparent)]" />

      <slot name="footer" />

      <div class="border-t border-white/10 p-2"><AccountMenu :identity="identity" /></div>
    </div>
  </aside>
</template>
