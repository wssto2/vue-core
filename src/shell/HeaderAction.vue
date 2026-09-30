<script setup lang="ts">
import { computed, inject } from "vue";
import { RouterLink, type RouteLocationRaw } from "vue-router";
import { Icon, type IconName } from "../icon";
import { headerSurfaceKey } from "./accountMenu";

/**
 * An icon button for the shell's header actions (a notification bell, a search button): what a
 * component contributed to the `headerActions` slot renders, so it looks right where the shell puts
 * it (light on the dark sidebar, tinted on the phone bar). `label` is the accessible name; say the
 * count in it too ("Notifications, 3 unread"), the badge itself is decorative.
 *
 *   <HeaderAction :label="t('search')" icon="search" @click="palette.present()" />
 *   <HeaderAction :label="t('inbox', { count })" icon="bell" :badge="count > 0 ? count : undefined" :to="inboxRoute" />
 *
 * `badge` is a count (capped visually by the caller) or `"dot"` for "something needs you".
 */
defineProps<{
  label: string;
  icon: IconName;
  /** Makes it a link to a route. */
  to?: RouteLocationRaw;
  badge?: number | string | "dot";
}>();

const emit = defineEmits<{ click: [] }>();

const surface = inject(headerSurfaceKey, "bar");
const onRail = computed(() => surface === "rail");
</script>

<template>
  <component :is="to ? RouterLink : 'button'" v-bind="to ? { to } : { type: 'button' }" :aria-label="label" data-header-action
    class="hit-target relative flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-motion-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
    :class="onRail ? 'size-9 text-gray-300 hover:bg-white/10 hover:text-white' : 'size-8 text-content-link active:bg-tint-soft'"
    @click="emit('click')">
    <Icon :name="icon" :size="onRail ? 20 : 18" />
    <span v-if="badge === 'dot'" aria-hidden="true" data-header-action-badge
      class="absolute top-1 right-1 size-2.5 rounded-full bg-status-danger-solid ring-2" :class="onRail ? 'ring-anchor-900' : 'ring-surface-page'"></span>
    <span v-else-if="badge !== undefined" aria-hidden="true" data-header-action-badge
      class="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-status-danger-solid px-1 text-center text-3xs leading-4 font-semibold text-white">{{ badge }}</span>
  </component>
</template>
