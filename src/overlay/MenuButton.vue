<script setup lang="ts">
import { Icon, type IconName } from "../icon";

/**
 * The "⋯" button of a `Menu`: an icon-only round button for its `#trigger` slot, with the trigger
 * attrs (`aria-haspopup`, `aria-expanded`, `aria-controls`) and a pressed look while the menu is
 * open. Spread the slot scope on it.
 *
 *   <Menu :items="items" :label="t('rowActions')">
 *     <template #trigger="trigger"><MenuButton v-bind="trigger" :label="t('rowActions')" /></template>
 *   </Menu>
 */
const props = withDefaults(defineProps<{
  /** The accessible name (the button shows only an icon). */
  label: string;
  icon?: IconName;
  /** The slot scope of `Menu`'s `#trigger`: */
  presented: boolean;
  toggle: () => void;
  attrs: Record<string, string | boolean>;
}>(), { icon: "moreLine" });
</script>

<template>
  <button type="button" v-bind="props.attrs" :aria-label="props.label"
    class="hit-target flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-fill text-content-strong transition-colors duration-motion-fast hover:bg-fill-strong data-pressed:bg-fill-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
    :data-pressed="props.presented || undefined" @click="props.toggle()">
    <Icon :name="props.icon" />
  </button>
</template>
