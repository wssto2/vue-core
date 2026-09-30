<script setup lang="ts">
import { toast } from "@wssto2/vue-core/overlay";
import { HeaderAction } from "@wssto2/vue-core/shell";
import { useI18n } from "vue-i18n";

// What a feature puts into the shell's `headerActions`: `HeaderAction` looks right wherever the shell draws it
// (light on the sidebar, tinted on the phone bar); the label is its accessible name, the badge is decorative.
const { t } = useI18n();
</script>

<template>
  <HeaderAction :label="t('notifications.label', { count: 3 })" icon="informationLine" :badge="3" @click="toast.info(t('notifications.none'))" />
</template>
