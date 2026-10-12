<script setup lang="ts">
import { Menu, MenuButton, type MenuItem } from "@wssto2/vue-core/overlay";
import { useI18n } from "vue-i18n";

defineProps<{ items: readonly MenuItem[] }>();

const { t } = useI18n();
</script>

<template>
  <Menu :items="items" :label="t('tickets.rowActions')">
    <template #trigger="trigger"><MenuButton v-bind="trigger" :label="t('tickets.rowActions')" /></template>
  </Menu>
</template>
