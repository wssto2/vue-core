<script lang="ts">
export interface BottomTabBarItem {
  value: string | number;
  label: string;
  icon?: IconName;
  active: boolean;
  badge?: string | number;
  /** `critical` for counts that are problems (form errors). */
  badgeTone?: "brand" | "critical";
  /** The reason the item needs attention; drawn as a dot, named for assistive tech. */
  warning?: string;
}
</script>

<script setup lang="ts">
import { Icon, type IconName } from "../icon";
import BottomDockPortal from "./BottomDockPortal.vue";

/**
 * A record's navigation as a phone or tablet tab bar: icons with a short label, pinned to the bottom
 * edge (iOS style). It renders into the bottom dock, which stacks it under any pinned action bar and
 * pads the page so content never hides behind it. Presentational: the owner decides what is active
 * and what a tap does.
 */
const props = defineProps<{
  items: readonly BottomTabBarItem[];
  label?: string;
}>();

const emit = defineEmits<{ select: [value: string | number] }>();
</script>

<template>
  <BottomDockPortal>
    <nav :aria-label="props.label"
      class="dock-safe-area dock-tab-bar pointer-events-auto order-last border-t border-border-separator bg-surface-cell/90 backdrop-blur-lg">
      <ul class="grid" :style="{ gridTemplateColumns: `repeat(${props.items.length}, minmax(0, 1fr))` }" role="tablist" :aria-label="props.label">
        <li v-for="item in props.items" :key="item.value" role="presentation">
          <button type="button" role="tab" :aria-selected="item.active" :tabindex="item.active ? 0 : -1"
            class="relative flex h-14 w-full cursor-pointer flex-col items-center justify-center gap-1 px-1 transition-colors duration-motion-fast focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus"
            :class="item.active ? 'text-content-link' : 'text-content-muted active:text-content-strong'"
            @click="emit('select', item.value)">
            <span class="relative">
              <Icon v-if="item.icon" :name="item.icon" :size="22" />
              <span v-if="item.badge"
                class="absolute -right-2.5 -top-1.5 min-w-4 rounded-full px-1 text-center text-3xs font-semibold leading-4"
                :class="item.badgeTone === 'critical' ? 'bg-status-danger-solid text-white' : 'bg-tint text-content-on-tint'">
                {{ item.badge }}
              </span>
              <span v-else-if="item.warning" class="absolute -right-1 -top-0.5 size-2 rounded-full bg-status-warning-solid ring-2 ring-surface-cell"></span>
            </span>
            <span v-if="item.warning" class="sr-only">{{ item.warning }}</span>
            <span class="w-full truncate text-center text-2xs" :class="item.active ? 'font-semibold' : 'font-medium'">{{ item.label }}</span>
          </button>
        </li>
      </ul>
    </nav>
  </BottomDockPortal>
</template>
