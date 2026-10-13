<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AccountMenuItem from "../shell/AccountMenuItem.vue";
import { useReturnToOwnAccount } from "./useReturnToOwnAccount";

/** The account menu's "Return to my account" row, there only while signed in as somebody else (the banner has the same way out). */
const { t } = useI18n();
const { impersonating, leave } = useReturnToOwnAccount();
</script>

<template>
  <AccountMenuItem v-if="impersonating" :label="t('core.identity.impersonation.return')" icon="logoutBoxRLine" data-return-menu-item @click="leave" />
</template>
