<script setup lang="ts">
import { ShellOutlet, useApplication } from "@wssto2/vue-core/app";
import { AppRouterView, useNavigation } from "@wssto2/vue-core/router";

// A small custom shell: the menu resolved from the server's tree, the header outlet, the routed page.
const navigation = useNavigation();
const { locale, locales, setLocale } = useApplication();
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="flex items-center gap-4 border-b border-border-separator px-screen-padding py-2">
      <nav aria-label="Main" class="flex flex-1 flex-wrap gap-3">
        <template v-for="group in navigation" :key="group.key">
          <RouterLink v-if="group.to" :to="group.to" class="text-content-link" :aria-current="group.active ? 'page' : undefined">{{ group.label }}</RouterLink>
          <template v-else>
            <RouterLink v-for="item in group.children" :key="item.key" :to="item.to ?? '/'" class="text-content-link" :aria-current="item.active ? 'page' : undefined">{{ item.label }}</RouterLink>
          </template>
        </template>
      </nav>
      <ShellOutlet name="headerActions" />
      <button v-for="each in locales.slice(0, 2)" :key="each" type="button" class="rounded-button px-2 py-1" :class="each === locale ? 'bg-tint-soft' : ''" @click="setLocale(each)">{{ each }}</button>
    </header>
    <main class="p-screen-padding"><AppRouterView /></main>
  </div>
</template>
