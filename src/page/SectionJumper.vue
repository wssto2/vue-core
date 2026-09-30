<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";
import Menu, { type MenuItem } from "../overlay/Menu.vue";
import BottomDockPortal from "./BottomDockPortal.vue";
import { useSectionIndex } from "./sectionIndex";
import type { SectionFormState } from "./types";

/**
 * The floating section control of a long page on compact screens: a capsule in the bottom dock with
 * the section in view ("02 Vehicle data"); tapping it lists the sections, and choosing one scrolls
 * there. The wide-screen counterpart is `SectionList`.
 */
const props = withDefaults(defineProps<{
  /** What a long form says about each section, by section id: a section with errors says so in the list and on the capsule. */
  states?: Readonly<Record<string, SectionFormState>>;
}>(), { states: undefined });

const { t } = useI18n();
const index = useSectionIndex();
const sections = computed(() => index?.sections.value ?? []);
const current = computed(() => sections.value.find((section) => section.id === index?.activeId.value) ?? sections.value[0] ?? null);
const name = (section: { number?: string; label: string }) => [section.number, section.label].filter(Boolean).join(" ");
const errorsOf = (id: string) => props.states?.[id]?.errors ?? 0;
const withErrors = (section: { id: string; number?: string; label: string }) => (errorsOf(section.id) > 0 ? `${name(section)} · ${t("core.form.sections.errors", { count: errorsOf(section.id) })}` : name(section));
const items = computed<MenuItem[]>(() => sections.value.map((section) => ({ id: section.id, label: withErrors(section), onSelect: () => void index?.scrollTo(section.id) })));
</script>

<template>
  <BottomDockPortal v-if="index && sections.length > 1 && current">
    <div class="dock-safe-area pointer-events-none" data-test="section-jumper">
      <div class="flex justify-center px-4 pb-3">
        <Menu :items="items" :label="t('core.sections.label')" placement="top">
          <template #trigger="{ toggle, attrs }">
            <button type="button" v-bind="attrs" :aria-label="`${t('core.sections.label')}: ${withErrors(current)}`"
              class="pointer-events-auto flex h-12 max-w-full cursor-pointer items-center gap-2.5 rounded-full bg-surface-overlay/90 pr-3.5 pl-4 shadow-float backdrop-blur-xl transition-colors duration-motion-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
              @click="toggle">
              <span v-if="current.number" class="text-footnote font-semibold tabular-nums text-content-link">{{ current.number }}</span>
              <span class="min-w-0 truncate text-headline font-semibold text-content-strong">{{ current.label }}</span>
              <span v-if="errorsOf(current.id) > 0" data-test="jumper-error-count" class="min-w-4.5 rounded-full bg-status-danger-solid px-1.5 text-center text-caption font-semibold text-white">{{ errorsOf(current.id) }}</span>
              <Icon name="arrowDownSLine" :size="16" class="shrink-0 rotate-180 text-content-muted" />
            </button>
          </template>
        </Menu>
      </div>
    </div>
  </BottomDockPortal>
</template>
