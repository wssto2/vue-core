<script setup lang="ts">
import { toast } from "@wssto2/vue-core/overlay";
import { Icon } from "@wssto2/vue-core/icon";
import { useI18n } from "vue-i18n";

// The shell's `search` slot: a field-shaped trigger at the top of the sidebar and of the phone drawer.
// It draws on the dark sidebar and on the light drawer, so it uses a translucent grey that reads on both.
const { t } = useI18n();
</script>

<template>
  <button type="button" class="flex h-9 w-full cursor-pointer items-center gap-2 rounded-control bg-gray-500/15 px-3 text-left text-callout text-gray-400 transition-colors duration-motion-fast hover:bg-gray-500/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
    @click="toast.info(t('session.search_soon'))">
    <Icon name="search" :size="16" />
    <span class="flex-1 truncate">{{ t("session.search") }}…</span>
  </button>
</template>
