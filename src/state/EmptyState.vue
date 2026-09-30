<script setup lang="ts">
import { Icon, type IconName } from "../icon";

/**
 * Nothing to show: an empty list, no search result, a section without records. `block` fills a
 * region with an icon, a title, an explanation and the one relevant action; `inline` is a single
 * muted line for a value or a small area that has nothing in it.
 *
 *   <EmptyState :title="t('noLeads')" :description="t('noLeadsHint')" icon="box2Line">
 *     <template #actions><Button prominence="primary">Add a lead</Button></template>
 *   </EmptyState>
 *   <EmptyState presentation="inline" :title="t('notEntered')" />
 */
const props = withDefaults(defineProps<{
  title: string;
  description?: string;
  icon?: IconName;
  presentation?: "block" | "inline";
}>(), {
  description: undefined,
  icon: "box2Line",
  presentation: "block",
});

defineSlots<{
  /** The single relevant action (add, clear the filter). */
  actions?: () => unknown;
}>();
</script>

<template>
  <span v-if="props.presentation === 'inline'" class="text-sm text-content-muted">{{ props.title }}</span>
  <div v-else class="flex flex-col items-center justify-center px-4 py-8 text-center">
    <Icon :name="props.icon" :size="32" class="mb-4 text-content-muted" />
    <p class="mb-2 font-semibold text-content-strong">{{ props.title }}</p>
    <p v-if="props.description" class="text-sm text-content-muted">{{ props.description }}</p>
    <!-- A class on <slot> renders nothing: the gap needs a wrapper. -->
    <div v-if="$slots.actions" class="mt-4 flex flex-wrap items-center justify-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
