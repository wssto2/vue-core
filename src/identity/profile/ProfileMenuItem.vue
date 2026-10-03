<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AccountMenuItem from "../../shell/AccountMenuItem.vue";
import { profileRoutes } from "./routes";

/** The entry of the account menu that opens "my profile". */
const { t } = useI18n();
</script>

<template>
  <AccountMenuItem :label="t('core.profile.menu')" icon="user3Line" :to="profileRoutes.index" data-profile-menu-item />
</template>
