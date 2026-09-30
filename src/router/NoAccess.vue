<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { EmptyState } from "../state";

/** What stands where a page the user may not open would be. Replace it with `createApplication({ noAccess })`. */
const { t } = useI18n();
</script>

<template>
  <EmptyState :title="t('core.no_access.title')" :description="t('core.no_access.body')" icon="errorWarningLine" />
</template>
