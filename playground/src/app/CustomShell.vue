<script setup lang="ts">
import { ShellOutlet } from "@wssto2/vue-core/app";
import { BottomDock, usePageChromeContext } from "@wssto2/vue-core/page";
import { AppRouterView } from "@wssto2/vue-core/router";
import { AccountSheet, NavigationDrawer, ShellSidebar, ShellStage, ShellTopBar, useShellIdentity } from "@wssto2/vue-core/shell";
import { useTemplateRef } from "vue";

// A shell of the application's own, composed from the library's pieces: the same sidebar, top bar,
// phone drawer and outlets as BackofficeShell, arranged differently (a narrow centred column, its
// own brand and footer, no toasts). Whatever features contribute to `headerActions`, `accountMenu`
// and `host` still arrives, because it renders the same `ShellOutlet`s.
const identity = useShellIdentity();
const chrome = usePageChromeContext();
const accountSheet = useTemplateRef("accountSheet");
</script>

<template>
  <div class="min-h-screen bg-surface-page text-content">
    <ShellStage :enabled="identity !== null">
      <template v-if="identity" #drawer="{ select, dismiss }">
        <NavigationDrawer :identity="identity" @select="select" @account="dismiss(() => accountSheet?.present())">
          <template #footer><p class="px-5 pb-2 text-footnote text-content-muted">Custom shell</p></template>
        </NavigationDrawer>
      </template>

      <ShellTopBar />
      <div class="flex">
        <ShellSidebar v-if="identity" :identity="identity">
          <template #brand><span class="block text-headline font-semibold text-white">Custom shell</span></template>
          <template #footer><p class="px-4 pb-2 text-footnote text-gray-400">Composed from the library's pieces</p></template>
        </ShellSidebar>
        <main class="mx-auto min-w-0 max-w-2xl flex-1" :class="chrome.hasShell.value ? '' : 'p-4 md:p-8'">
          <AppRouterView />
        </main>
      </div>
      <BottomDock :class="identity ? 'md:left-64' : ''" />
    </ShellStage>
    <AccountSheet v-if="identity" ref="accountSheet" :identity="identity" />
    <ShellOutlet name="host" />
  </div>
</template>
