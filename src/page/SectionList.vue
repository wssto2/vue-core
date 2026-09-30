<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSectionIndex } from "./sectionIndex";

/**
 * The sections of a long page, in order, the one in view marked; choosing one scrolls there. With
 * more than one section it is the page's list (`standalone`, with a heading) or sits under the
 * active section of `SectionNavigator`'s source list. On compact screens `SectionJumper` replaces it.
 */
const props = withDefaults(defineProps<{
  /** A page sidebar with its own heading and landmark, instead of a list under a source-list item. */
  standalone?: boolean;
}>(), { standalone: false });

const { t } = useI18n();
const index = useSectionIndex();
const sections = computed(() => index?.sections.value ?? []);
</script>

<template>
  <component :is="props.standalone ? 'nav' : 'div'" v-if="sections.length > 1" data-test="section-list"
    :class="props.standalone ? 'flex min-w-0 flex-col gap-3.5' : 'mt-1 mb-2 pl-2'" :aria-label="props.standalone ? t('core.sections.label') : undefined">
    <h2 v-if="props.standalone" class="px-2.5 text-caption font-semibold tracking-wide text-content-muted uppercase">{{ t("core.sections.label") }}</h2>
    <ul class="flex flex-col gap-0.5">
      <li v-for="section in sections" :key="section.id">
        <a :href="`#${section.id}`" :aria-current="index?.activeId.value === section.id ? 'location' : undefined" :data-test="`section-link-${section.id}`"
          class="flex min-h-[2.125rem] items-center gap-2.5 rounded-control px-2.5 py-1 text-body text-content-strong transition-colors duration-motion-fast focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus"
          :class="index?.activeId.value === section.id ? 'bg-tint-soft font-semibold' : 'hover:bg-fill'"
          @click.prevent="index?.scrollTo(section.id)">
          <span v-if="section.number" class="w-5 shrink-0 text-footnote font-semibold tabular-nums text-content-link">{{ section.number }}</span>
          <span class="min-w-0 flex-1 break-words">{{ section.label }}</span>
        </a>
      </li>
    </ul>
  </component>
</template>
