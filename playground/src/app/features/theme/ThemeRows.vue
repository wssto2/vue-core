<script setup lang="ts">
import { AccountMenuItem } from "@wssto2/vue-core/shell";
import { ref } from "vue";
import { useI18n } from "vue-i18n";

// Two entries the application adds to the account menu: a switch (dark mode) and one (the violet accent).
// The state lives on <html>, where the stylesheet reads it, and the rows start from it.
const { t } = useI18n();
const root = document.documentElement;
const dark = ref(root.classList.contains("dark"));
const violet = ref(root.dataset.accent === "violet");

function toggleDark() {
  dark.value = !dark.value;
  root.classList.toggle("dark", dark.value);
}

function toggleAccent() {
  violet.value = !violet.value;
  root.dataset.accent = violet.value ? "violet" : "emerald";
}
</script>

<template>
  <AccountMenuItem :label="t('theme.dark')" :icon="dark ? 'moonLine' : 'sunLine'" :checked="dark" @click="toggleDark" />
  <AccountMenuItem :label="t('theme.violet')" icon="contrastLine" :checked="violet" @click="toggleAccent" />
</template>
