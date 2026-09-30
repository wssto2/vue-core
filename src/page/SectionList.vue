<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";
import { useSectionIndex } from "./sectionIndex";
import type { SectionFormState } from "./types";

/**
 * The sections of a long page, in order, the one in view marked; choosing one scrolls there. With
 * more than one section it is the page's list (`standalone`, with a heading) or sits under the
 * active section of `SectionNavigator`'s source list. On compact screens `SectionJumper` replaces it.
 */
const props = withDefaults(defineProps<{
  /** A page sidebar with its own heading and landmark, instead of a list under a source-list item. */
  standalone?: boolean;
  /** What a long form says about each section, by section id: a count of fields in error, or a check once every required field is filled. */
  states?: Readonly<Record<string, SectionFormState>>;
  /** The required fields of the whole page, drawn as a progress bar under the list. */
  progress?: { readonly filled: number; readonly total: number } | null;
}>(), { standalone: false, states: undefined, progress: null });

const emit = defineEmits<{ select: [id: string] }>();

const { t } = useI18n();
const index = useSectionIndex();
const sections = computed(() => index?.sections.value ?? []);
const errorsOf = (id: string) => props.states?.[id]?.errors ?? 0;
const done = (id: string) => {
  const required = props.states?.[id]?.required;
  return !!required && required.total > 0 && required.filled === required.total && errorsOf(id) === 0;
};
function choose(id: string) {
  void index?.scrollTo(id);
  emit("select", id);
}
</script>

<template>
  <component :is="props.standalone ? 'nav' : 'div'" v-if="sections.length > 1" data-test="section-list"
    :class="props.standalone ? 'flex min-w-0 flex-col gap-3.5' : 'mt-1 mb-2 pl-2'" :aria-label="props.standalone ? t('core.sections.label') : undefined">
    <h2 v-if="props.standalone" class="px-2.5 text-caption font-semibold tracking-wide text-content-muted uppercase">{{ t("core.sections.label") }}</h2>
    <ul class="flex flex-col gap-0.5">
      <li v-for="section in sections" :key="section.id">
        <a :href="`#${section.id}`" :aria-current="index?.activeId.value === section.id ? 'location' : undefined" :data-test="`section-link-${section.id}`" :data-state="errorsOf(section.id) > 0 ? 'error' : done(section.id) ? 'done' : undefined"
          class="flex min-h-[2.125rem] items-center gap-2.5 rounded-control px-2.5 py-1 text-body text-content-strong transition-colors duration-motion-fast focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus"
          :class="index?.activeId.value === section.id ? 'bg-tint-soft font-semibold' : 'hover:bg-fill'"
          @click.prevent="choose(section.id)">
          <span v-if="section.number" class="w-5 shrink-0 text-footnote font-semibold tabular-nums text-content-link">{{ section.number }}</span>
          <span class="min-w-0 flex-1 break-words">{{ section.label }}</span>
          <span v-if="errorsOf(section.id) > 0" data-test="section-error-count" class="min-w-4.5 rounded-full bg-status-danger-solid px-1.5 text-center text-caption font-semibold text-white"
            :aria-label="t('core.form.sections.errors', { count: errorsOf(section.id) })">{{ errorsOf(section.id) }}</span>
          <span v-else-if="done(section.id)" class="flex size-4 shrink-0 items-center justify-center rounded-full bg-control-on text-white">
            <Icon name="checkCustom" :size="12" />
            <span class="sr-only">{{ t("core.form.sections.done") }}</span>
          </span>
        </a>
      </li>
    </ul>

    <div v-if="props.progress && props.progress.total > 0" class="mx-2.5 flex flex-col gap-1.5 border-t border-border-separator pt-3.5" data-test="section-progress">
      <span class="text-footnote text-content-muted">{{ t("core.form.required.label") }}</span>
      <div class="h-1 overflow-hidden rounded-full bg-fill" role="progressbar" :aria-valuemin="0" :aria-valuemax="props.progress.total" :aria-valuenow="props.progress.filled" :aria-label="t('core.form.required.label')">
        <div class="h-1 rounded-full bg-control-on transition-[width] duration-motion-normal" :style="{ width: `${Math.round((props.progress.filled / props.progress.total) * 100)}%` }"></div>
      </div>
      <span class="text-footnote tabular-nums text-content-muted">{{ t("core.form.required.count", { filled: props.progress.filled, total: props.progress.total }) }}</span>
    </div>
  </component>
</template>
