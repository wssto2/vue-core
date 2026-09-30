<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";
import { useNavigationDrawer } from "./drawer";

/**
 * The phone bar's round menu button on a module page (UI decision D18): opens the navigation
 * drawer of the enclosing `ShellStage`. Renders nothing where there is no drawer (a wide screen,
 * signed out, a shell without a stage).
 */
const drawer = useNavigationDrawer();
const { t } = useI18n();
</script>

<template>
  <button v-if="drawer?.available.value" type="button" data-shell-menu-button :aria-label="t('core.shell.menu')" :aria-expanded="drawer.open.value"
    :aria-controls="drawer.panelId" aria-haspopup="dialog"
    class="relative my-1 ml-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface-cell text-content-strong shadow-float transition-transform duration-motion-fast active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
    @click="drawer.present()">
    <Icon name="menuLines" :size="20" />
  </button>
</template>
