<script setup lang="ts">
import { Icon } from "../icon";
import { Tooltip } from "../overlay";
import type { RowAction } from "./columns";

/**
 * The actions of a row as icon buttons in its actions cell: view, edit, delete, download. The same
 * `RowAction[]` a table gives its swipe and context menu, so a row's actions are written once; the
 * page builds the array from what the user may do (`access.can(...)`), so there is nothing to hide
 * here. A link (`href`) is an anchor, a command (`onSelect`) a button; `critical` is red.
 *
 *   <template #actions="{ item }"><RowActions :actions="rowActions(item)" :disabled="item.locked" /></template>
 *
 * `disabled` greys out every button (a locked row); it does not hide them.
 */
const props = withDefaults(defineProps<{
  actions: readonly RowAction[];
  disabled?: boolean;
}>(), { disabled: false });

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";
const tone = (action: RowAction) =>
  action.tone === "critical" ? "text-status-danger-content hover:bg-status-danger-surface" : "text-content-link hover:bg-tint-soft";
</script>

<template>
  <div v-if="props.actions.length > 0" class="flex items-center justify-center gap-1" data-test="row-actions">
    <Tooltip v-for="action in props.actions" :key="action.key" :text="action.label" side="left">
      <a v-if="action.href && !props.disabled" :href="action.href" :target="action.external ? '_blank' : undefined" :rel="action.external ? 'noopener' : undefined"
        :aria-label="action.label" :data-action="action.key" class="inline-flex rounded-md p-1.5 transition-colors" :class="[tone(action), FOCUS]">
        <Icon :name="action.icon" :size="18" />
      </a>
      <button v-else type="button" :aria-label="action.label" :data-action="action.key" :disabled="props.disabled"
        class="inline-flex cursor-pointer rounded-md p-1.5 transition-colors disabled:pointer-events-none disabled:opacity-40" :class="[tone(action), FOCUS]"
        @click="action.onSelect?.()">
        <Icon :name="action.icon" :size="18" />
      </button>
    </Tooltip>
  </div>
</template>
