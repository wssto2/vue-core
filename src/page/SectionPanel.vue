<script setup lang="ts">
import { computed, useId, useTemplateRef } from "vue";
import Panel from "../content/Panel.vue";
import { sectionId, useSectionAnchor } from "./sectionIndex";

/**
 * A `Panel` of a long page that the section list links to: it registers with the page's section
 * index, so `SectionList` lists it, `SectionJumper` jumps to it and the scroll spy knows it. Jumping to a
 * collapsed one expands it. Everything else is the `Panel`'s (its props, slots and `v-model:collapsed`).
 *
 *   <SectionPanel :title="t('identification')" number="01" presentation="section">…</SectionPanel>
 *
 * The anchor (and URL fragment) is a slug of the title; pass `id` when the title carries data or two
 * sections share one. Outside a section index it is the plain `Panel`.
 */
const props = defineProps<{
  title: string;
  /** The anchor id and URL fragment; by default a slug of the title. */
  id?: string;
  /** Shown before the title in the panel and in the section list ("02"). */
  number?: string;
}>();

defineOptions({ inheritAttrs: false });
defineSlots<{ actions?: () => unknown; footer?: () => unknown; default?: () => unknown }>();

const anchor = props.id ?? (sectionId(props.title) || `section-${useId()}`);
const panel = useTemplateRef<InstanceType<typeof Panel>>("panel");
const element = computed(() => (panel.value?.$el as HTMLElement | undefined) ?? null);

useSectionAnchor(anchor, () => props.title, element, { number: () => props.number, reveal: () => panel.value?.expand() });
</script>

<template>
  <Panel ref="panel" v-bind="{ ...$attrs, id: anchor, tabindex: -1 }" :title="props.title" :number="props.number" class="scroll-mt-[calc(var(--app-bar-height)+1.5rem)]">
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
    <slot />
  </Panel>
</template>
