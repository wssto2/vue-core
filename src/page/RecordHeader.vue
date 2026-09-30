<script setup lang="ts">
import { useTemplateRef } from "vue";
import { Icon } from "../icon";
import { useLargeTitle } from "./useLargeTitle";
import type { QuickAction } from "./types";

/**
 * Who or what this page is about: the avatar or tile, the record's large title, meta badges and
 * quick actions (Call, E-mail).
 *
 * - Wide: avatar left, title and meta beside it, quick actions as tinted buttons on the right.
 * - Compact: centred avatar and title with the meta as one line, quick actions as tiles below.
 *
 * The title is the page's h1 and collapses into the phone nav bar on scroll.
 *
 *   <RecordHeader :title="name" :subtitle="`${type} · ${city}`" :quick-actions="contact">
 *     <template #leading><Avatar :name="name" size="xl" tone="anchor" /></template>
 *     <template #meta><Badge>…</Badge></template>
 *   </RecordHeader>
 */
const props = withDefaults(defineProps<{
  title: string;
  /** One line under the title on compact screens (the meta's text). */
  subtitle?: string;
  quickActions?: readonly QuickAction[];
}>(), { subtitle: undefined, quickActions: () => [] });

defineSlots<{ leading?: () => unknown; meta?: () => unknown }>();

const titleElement = useTemplateRef<HTMLElement>("titleElement");
useLargeTitle(titleElement, () => props.title);
</script>

<template>
  <div class="flex min-w-0 flex-wrap items-center gap-5 compact:flex-col compact:gap-2 compact:text-center">
    <div v-if="$slots.leading" class="min-w-0 max-w-full shrink-0"><slot name="leading" /></div>

    <div class="flex min-w-0 flex-[1_1_14rem] flex-col gap-1.5 compact:w-full compact:flex-none compact:items-center compact:gap-1">
      <h1 ref="titleElement" class="text-large-title font-semibold tracking-tight break-words text-content-strong compact:mt-1.5">{{ props.title }}</h1>
      <div v-if="$slots.meta" class="flex min-w-0 flex-wrap items-center gap-2.5 text-subheadline text-content-muted compact:hidden">
        <slot name="meta" />
      </div>
      <p v-if="props.subtitle" class="hidden text-subheadline text-content-muted compact:block">{{ props.subtitle }}</p>
    </div>

    <nav v-if="props.quickActions.length"
      class="flex max-w-full flex-wrap gap-2 compact:mt-3 compact:grid compact:w-full compact:auto-cols-fr compact:grid-flow-col">
      <component :is="action.href ? 'a' : 'button'" v-for="action in props.quickActions" :key="action.id" :href="action.href"
        :type="action.href ? undefined : 'button'" :data-quick-action="action.id"
        class="hit-target flex min-w-0 max-w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-tint-soft px-4 py-1.5 text-subheadline font-semibold text-content-link transition duration-motion-fast hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus dark:hover:brightness-125 compact:flex-col compact:gap-1 compact:rounded-group compact:bg-surface-cell compact:px-2 compact:py-2.5 compact:text-footnote compact:font-medium compact:shadow-group"
        @click="action.onClick?.()">
        <Icon :name="action.icon" class="compact:size-5.5" />
        <span class="truncate">{{ action.label }}</span>
      </component>
    </nav>
  </div>
</template>
