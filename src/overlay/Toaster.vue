<script setup lang="ts">
import { Toaster } from "vue-sonner";
import { useI18n } from "vue-i18n";

/**
 * Renders the page's toasts (see `toast`): an inverse card with a coloured icon and an accent
 * action, stacked bottom centre above whatever is docked. Mount one, at the root of the app.
 * The look (inverse surface, status icon colours, lift above the bottom dock) comes from the
 * library's stylesheet.
 */
withDefaults(defineProps<{ position?: "bottom-center" | "top-right" }>(), { position: "bottom-center" });

const { t } = useI18n();
</script>

<template>
  <Toaster :position="position" :container-aria-label="t('core.toast.notifications')" />
</template>
