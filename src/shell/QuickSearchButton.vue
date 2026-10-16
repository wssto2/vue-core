<script setup lang="ts">
import { computed, inject } from "vue";
import { useI18n } from "vue-i18n";
import { shortcutKeys } from "../button";
import { Icon } from "../icon";
import { headerSurfaceKey } from "./accountMenu";
import { useQuickSearch } from "./quickSearchControl";

/**
 * The quick-search field of the shell's `search` slot: it looks like a field and opens the palette.
 * On the dark sidebar its greys are translucent; in the phone drawer it uses the fill tokens.
 */
const { t } = useI18n();
const search = useQuickSearch();
const onRail = inject(headerSurfaceKey, "bar") === "rail";
const keys = computed(() => shortcutKeys({ key: "k", mod: true }).join(" "));
</script>

<template>
  <button type="button" data-test="quick-search-button"
    class="flex h-9 w-full cursor-pointer items-center gap-2 rounded-control px-3 text-left text-callout transition-colors duration-motion-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
    :class="onRail ? 'bg-gray-500/15 text-gray-400 hover:bg-gray-500/25' : 'bg-fill text-content-muted hover:bg-fill-strong'"
    @click="search.open()">
    <Icon name="search" :size="16" class="shrink-0" />
    <span class="flex-1 truncate">{{ t("core.shell.search.open") }}…</span>
    <!-- A touch screen has no keyboard to press it on. -->
    <kbd class="rounded border px-1.5 text-caption [@media(pointer:coarse)]:hidden" :class="onRail ? 'border-gray-500/30' : 'border-border-separator'">{{ keys }}</kbd>
  </button>
</template>
