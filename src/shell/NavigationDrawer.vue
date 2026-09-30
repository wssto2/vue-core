<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { RouteLocationRaw } from "vue-router";
import { Avatar } from "../content";
import { Icon } from "../icon";
import NavigationList from "./NavigationList.vue";
import ShellBrand from "./ShellBrand.vue";
import type { ShellIdentity } from "./identity";

/**
 * The phone navigation drawer's content (UI decision D18): the brand (home), the destinations (the
 * same model as the desktop rail), a `footer` slot, and the account row pinned at the bottom.
 * Presentation only: the `ShellStage` around it owns opening, closing, gestures and focus, and the
 * owner acts on the events:
 *
 * - `select`: a destination was chosen (navigate, then close: the stage's `select`);
 * - `account`: the account row was chosen (close, then present the `AccountSheet`).
 */
defineProps<{ identity: ShellIdentity; home?: RouteLocationRaw }>();
const emit = defineEmits<{ select: [to: RouteLocationRaw]; account: [] }>();

defineSlots<{
  /** The logo, drawn on the page surface. */
  brand?: (scope: { tone: "light" | "brand" }) => unknown;
  footer?: () => unknown;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="flex h-full flex-col bg-surface-page text-content-strong" data-shell-drawer-content>
    <div class="shrink-0 pt-[calc(max(0.75rem,env(safe-area-inset-top))+0.75rem)] pr-4 pb-4 pl-[max(1.375rem,env(safe-area-inset-left))]">
      <ShellBrand :to="home" tone="brand" intercept class="max-w-36" @select="emit('select', $event)">
        <template v-if="$slots.brand" #default="scope"><slot name="brand" v-bind="scope" /></template>
      </ShellBrand>
    </div>
    <div class="mx-5.5 shrink-0 border-t border-border-separator" role="presentation"></div>

    <!-- Destinations scroll on their own; the last rows fade under the account row. -->
    <NavigationList appearance="drawer" :label="t('core.shell.menu')"
      class="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-2 pr-2.5 pb-3 pl-[max(0.625rem,env(safe-area-inset-left))] [mask-image:linear-gradient(to_bottom,black_calc(100%-1.5rem),transparent)]"
      @select="emit('select', $event)" />

    <slot name="footer" />

    <button type="button" data-shell-drawer-account aria-haspopup="dialog"
      class="flex shrink-0 cursor-pointer items-center gap-3 border-t border-border-separator pt-3 pr-4 pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1.125rem,env(safe-area-inset-left))] text-left transition-colors duration-motion-fast active:bg-fill focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus"
      @click="emit('account')">
      <Avatar :name="identity.name" size="lg" />
      <span class="min-w-0 flex-1">
        <span class="block truncate text-headline font-semibold">{{ identity.name }}</span>
        <span v-if="identity.detail" class="block truncate text-footnote text-content-muted">{{ identity.detail }}</span>
      </span>
      <Icon name="arrowRightSLine" :size="18" class="shrink-0 text-content-disabled" />
    </button>
  </div>
</template>
