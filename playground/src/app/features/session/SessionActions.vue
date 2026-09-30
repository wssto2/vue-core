<script setup lang="ts">
import { toast } from "@wssto2/vue-core/overlay";
import { HeaderAction } from "@wssto2/vue-core/shell";
import { useI18n } from "vue-i18n";

// A header contribution of the session feature: shown only while signed in. The shell draws it on
// the sidebar (desktop) or beside the menu button (phone); `HeaderAction` fits both.
const { t } = useI18n();
</script>

<template>
  <HeaderAction :label="t('session.notifications', { count: 3 })" icon="informationLine" badge="dot" @click="toast.info(t('session.notifications_empty'))" />
  <HeaderAction :label="t('session.search')" icon="search" @click="toast.info(t('session.search_soon'))" />
</template>
