<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AccountMenuItem from "./AccountMenuItem.vue";

/**
 * The dark-mode switch of the shell's account menu. A row with a state and nothing else: the app
 * (or `darkMode()`) says whether it is on and what choosing it does.
 *
 *   <DarkModeRow :dark="preferences.dark" @toggle="preferences.set(!preferences.dark)" />
 */
const props = defineProps<{ dark: boolean }>();
const emit = defineEmits<{ toggle: [] }>();

const { t } = useI18n();
</script>

<template>
  <AccountMenuItem :label="t('core.shell.dark_mode')" icon="moonLine" :checked="props.dark" @click="emit('toggle')" />
</template>
