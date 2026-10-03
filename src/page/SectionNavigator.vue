<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { RouterLink } from "vue-router";
import { IconTile } from "../controls";
import { Icon } from "../icon";
import { useMediaQuery } from "../internal/mediaQuery";
import { useRouteAccess } from "../router/access";
import { useFirstSectionRedirect, useRouteSections, type SectionLink } from "../router/sections";
import { pageSectionBackKey } from "./sectionBack";
import { provideSectionIndex } from "./sectionIndex";
import SectionJumper from "./SectionJumper.vue";
import SectionList from "./SectionList.vue";
import type { SectionStep } from "./types";

/**
 * The sections of a record page, from its child routes' `meta.section` (see `useRouteSections`): one
 * navigation for every width, so a page keeps no array of links of its own.
 *
 *   <SectionNavigator :label="t('dealer.sections')" desktop="sidebar" compact="rows" :back-label="dealer.name">
 *     <template #summary><DealerSummary :dealer="dealer" /></template>
 *     <AppRouterView />
 *   </SectionNavigator>
 *
 * | Width | Variant | Presentation |
 * |---|---|---|
 * | wide | `desktop="segments"` (default) | a segmented control of full labels above the content (short labels when a full one would be cut) |
 * | wide | `desktop="sidebar"` | a source list beside the content: icon tile, label, count; the active section lists its in-page sections |
 * | compact | `compact="segmented"` (default) | a segmented control of short labels, pinned under the phone nav bar while the section scrolls |
 * | compact | `compact="rows"` | drill-in rows at the top of the first section; every other section goes back to it |
 * | compact | `compact="auto"` | segmented up to five sections, rows beyond |
 *
 * `steps` makes the record a workflow instead: the sections are large tiles in order, on every width (the `desktop` and `compact` variants
 * do not apply). Each tile is the section's link with its number (a ✓ once done), its label (short on phones), one line saying where the step
 * stands, in a tone, and the shown step tinted. They are links in any order, not a wizard: the work goes on over days, by several people.
 * A long form inside a step lists its own sections beside it on wide screens.
 *
 *   <SectionNavigator :label="t('appraisal.steps')" :steps="{
 *     'appraisal.valuation': { done: true, sub: '12 400 €' },
 *     'appraisal.report': { done: false, sub: 'Missing: market comparison', shortSub: 'Missing data', tone: 'warning' },
 *   }" />
 *
 * `#summary` sits above the links in the same sidebar (wide) and before the links (compact): one
 * sidebar, never a second one next to it. A page inside a section (`meta.sectionParent`) keeps the section
 * active and gets a back to it on every width. One section renders no navigation. A record whose
 * sections the session may open none of shows the no-access state in their place. It is also the
 * section index of its content: `SectionPanel`s inside a section are listed under it (wide) or in the
 * floating jumper (compact, three or more).
 */
const props = withDefaults(defineProps<{
  /** The accessible name of the navigation ("Parts of the dealer"). */
  label: string;
  desktop?: "sidebar" | "segments";
  compact?: "segmented" | "rows" | "auto";
  /** The back label of a nested section on compact screens, and the record's name in the path of a page inside a section. */
  backLabel?: string;
  /** A quiet count per section route name ("Locations 4"). */
  counts?: Readonly<Record<string, string | number>>;
  /** The record is a workflow: each section route's state, as tiles (see above). A section without an entry is not done and has no line. */
  steps?: Readonly<Record<string, SectionStep>>;
}>(), {
  desktop: "segments",
  compact: "segmented",
  backLabel: undefined,
  counts: () => ({}),
  steps: undefined,
});

defineSlots<{
  default?: () => unknown;
  /** The record's identity above the section links. */
  summary?: () => unknown;
}>();

const { t } = useI18n();
const state = useRouteSections();
useFirstSectionRedirect(state);
const { sections, active, first, subPage } = state;
const index = provideSectionIndex();
const routeAccess = useRouteAccess();

// The same breakpoint as the tables and tabs.
const wide = useMediaQuery("(min-width: 64rem)");
const variant = computed(() => (props.steps ? "steps" : wide.value ? props.desktop : props.compact === "auto" ? (sections.value.length > 5 ? "rows" : "segmented") : props.compact));
const hasNav = computed(() => sections.value.length > 1);
const noAccess = computed(() => state.declared.value > 0 && sections.value.length === 0);
const onFirst = computed(() => !!active.value && active.value.name === first.value?.name && !subPage.value);
const hasList = computed(() => index.sections.value.length > 1);
// A long form inside a step lists its own sections beside it.
const stepsAside = computed(() => variant.value === "steps" && wide.value && hasList.value);
const stepOf = (name: string): SectionStep => props.steps?.[name] ?? { done: false };
const STEP_TONE = { positive: "text-status-success-content", warning: "text-status-warning-content", critical: "text-status-danger-content" } as const;

// A page inside a section goes back to the section on every width, with the record and the section
// as the desktop path. Drill-in rows: a nested section goes back to the first one.
const sectionBack = inject(pageSectionBackKey, null);
watch(
  () => {
    if (subPage.value && active.value && first.value) {
      const record = { label: props.backLabel || first.value.label, to: first.value.to };
      // A page inside the first section itself names that section once, not as both the record and the section.
      const inFirst = active.value.name === first.value.name && !props.backLabel;
      return { label: active.value.shortLabel, to: active.value.to, path: inFirst ? [record] : [record, { label: active.value.label, to: active.value.to }] };
    }
    return variant.value === "rows" && hasNav.value && !onFirst.value && first.value ? { label: props.backLabel || first.value.label, to: first.value.to } : null;
  },
  (value) => {
    if (sectionBack) sectionBack.value = value;
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  if (sectionBack) sectionBack.value = null;
});

// Drill-in rows: every section after the first, one group per heading.
const rowGroups = computed(() => {
  const groups: { key: string; header?: string; sections: SectionLink[] }[] = [];
  for (const section of sections.value.slice(1)) {
    const last = groups[groups.length - 1];
    if (last && last.header === section.group) last.sections.push(section);
    else groups.push({ key: section.name, header: section.group, sections: [section] });
  }
  return groups;
});

// Wide segments show full labels, and fall back to the short ones when a full label would be cut.
const segments = useTemplateRef<HTMLElement>("segments");
const short = ref(false);
async function fitLabels() {
  if (variant.value !== "segments" || !segments.value) return;
  short.value = false;
  await nextTick();
  const labels = segments.value?.querySelectorAll<HTMLElement>("[data-segment-label]") ?? [];
  short.value = [...labels].some((label) => label.scrollWidth > label.clientWidth + 1);
}
let observer: ResizeObserver | null = null;
onMounted(() => {
  if (typeof ResizeObserver === "undefined" || !segments.value) return;
  observer = new ResizeObserver(() => void fitLabels());
  observer.observe(segments.value);
});
onBeforeUnmount(() => observer?.disconnect());
watch([variant, sections], () => void fitLabels(), { flush: "post" });
const segmentLabel = (section: SectionLink) => (variant.value === "segments" && !short.value ? section.label : section.shortLabel);
</script>

<template>
  <div v-if="noAccess" data-test="section-navigator" data-variant="none"><component :is="routeAccess.noAccess" /></div>

  <!-- A source list beside the content -->
  <div v-else-if="hasNav && variant === 'sidebar'" data-test="section-navigator" data-variant="sidebar"
    class="grid min-w-0 grid-cols-[minmax(0,15rem)_minmax(0,1fr)] items-start gap-8">
    <aside class="sticky top-[calc(var(--app-bar-height)+1rem+var(--shell-banner-h,0px))] flex min-w-0 flex-col gap-4 self-start">
      <slot name="summary" />
      <nav :aria-label="props.label">
        <ul class="flex flex-col gap-0.5">
          <li v-for="(section, position) in sections" :key="section.name">
            <!-- A group heading where the group changes. -->
            <div v-if="section.group && section.group !== sections[position - 1]?.group" data-test="section-group"
              class="px-2.5 pb-1.5 text-caption font-semibold tracking-wide text-content-muted uppercase" :class="position > 0 ? 'pt-4' : 'pt-1'">
              {{ section.group }}
            </div>
            <RouterLink v-slot="{ href, navigate }" :to="section.to" custom>
              <a :href="href" :aria-current="section.active ? 'page' : undefined" :data-test="`section-${section.name}`"
                class="flex min-h-[2.125rem] items-center gap-2.5 rounded-control py-1 pr-2.5 pl-1.5 text-body text-content-strong transition-colors duration-motion-fast focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus"
                :class="section.active ? 'bg-tint-soft font-semibold' : 'hover:bg-fill'" @click="navigate">
                <IconTile :tone="section.active ? 'brand' : 'anchor'" :icon="section.icon" />
                <span class="min-w-0 flex-1 truncate">{{ section.label }}</span>
                <span v-if="props.counts[section.name] !== undefined" class="text-subheadline tabular-nums text-content-muted">{{ props.counts[section.name] }}</span>
              </a>
            </RouterLink>
            <SectionList v-if="section.active && hasList" />
          </li>
        </ul>
      </nav>
    </aside>
    <div class="min-w-0"><slot /></div>
  </div>

  <div v-else data-test="section-navigator" :data-variant="hasNav ? variant : 'none'" class="flex min-w-0 flex-col gap-section-gap">
    <!-- The summary sits with the navigation: above the segments, and with the rows on the first section. -->
    <div v-if="$slots.summary && (variant !== 'rows' || onFirst || !hasNav)" data-test="section-summary"><slot name="summary" /></div>

    <!-- A workflow's steps: the number or a check, the label, where it stands, the shown step tinted -->
    <nav v-if="hasNav && variant === 'steps'" :aria-label="props.label" data-test="section-steps">
      <ol class="flex gap-2.5 compact:gap-1.5">
        <li v-for="(section, position) in sections" :key="section.name" class="flex min-w-0 flex-1">
          <RouterLink v-slot="{ href, navigate }" :to="section.to" custom>
            <a :href="href" :aria-current="section.active ? 'step' : undefined" :data-test="`section-${section.name}`" :data-done="stepOf(section.name).done ? 'true' : undefined"
              class="flex min-w-0 flex-1 items-center gap-3 rounded-group px-4 py-3 transition-colors duration-motion-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus compact:flex-col compact:items-start compact:gap-1.5 compact:p-2"
              :class="section.active ? 'bg-tint-soft ring-2 ring-tint ring-inset' : 'bg-surface-cell shadow-group hover:bg-fill'" @click="navigate">
              <span v-if="stepOf(section.name).done" class="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-control-on text-white"><Icon name="checkCustom" :size="14" /></span>
              <span v-else class="flex size-6.5 shrink-0 items-center justify-center rounded-full text-footnote font-semibold"
                :class="section.active ? 'bg-tint text-content-on-tint' : 'text-content-muted ring-2 ring-fill-strong ring-inset'">{{ position + 1 }}</span>
              <span class="flex min-w-0 flex-col">
                <span class="truncate text-headline compact:text-footnote" :class="section.active || stepOf(section.name).done ? 'font-semibold text-content-strong' : 'font-medium text-content-muted'">
                  <span class="compact:hidden">{{ section.label }}</span><span class="hidden compact:inline">{{ section.shortLabel }}</span>
                </span>
                <span v-if="stepOf(section.name).sub" data-test="section-step-sub" class="truncate text-footnote compact:text-caption"
                  :class="stepOf(section.name).tone ? STEP_TONE[stepOf(section.name).tone!] : 'text-content-muted'"><span :class="stepOf(section.name).shortSub ? 'compact:hidden' : ''">{{ stepOf(section.name).sub }}</span><span v-if="stepOf(section.name).shortSub" class="hidden compact:inline">{{ stepOf(section.name).shortSub }}</span></span>
                <span v-if="stepOf(section.name).done" class="sr-only">{{ t("core.steps.done") }}</span>
              </span>
            </a>
          </RouterLink>
        </li>
      </ol>
    </nav>

    <!-- A segmented control: full labels on wide screens, short ones on compact screens. -->
    <div v-if="hasNav && (variant === 'segments' || variant === 'segmented')"
      :class="variant === 'segmented' ? 'z-20 -mx-screen-padding bg-surface-page/90 px-screen-padding py-2 backdrop-blur-xl max-md:sticky max-md:top-[calc(max(0.25rem,env(safe-area-inset-top))+var(--app-bar-height)+0.25rem+1px+var(--shell-banner-h,0px))]' : ''">
      <nav ref="segments" :aria-label="props.label" class="max-w-full overflow-x-auto rounded-control bg-fill p-0.5 scrollbar-hide">
        <ul class="flex gap-0.5">
          <li v-for="section in sections" :key="section.name" class="flex min-w-0 flex-1">
            <RouterLink v-slot="{ href, navigate }" :to="section.to" custom>
              <a :href="href" :aria-current="section.active ? 'page' : undefined" :data-test="`section-${section.name}`"
                class="flex min-h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-control px-3 py-1 text-subheadline whitespace-nowrap transition-colors duration-motion-fast focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus compact:min-h-[2.125rem] compact:px-1.5"
                :class="section.active ? 'bg-segment-selected font-semibold text-content-strong shadow-sm' : 'font-medium text-content hover:text-content-strong'"
                @click="navigate">
                <span class="truncate" data-segment-label :title="segmentLabel(section) !== section.label ? section.label : undefined">{{ segmentLabel(section) }}</span>
                <span v-if="props.counts[section.name] !== undefined" data-test="section-count"
                  class="min-w-[1.125rem] rounded-full px-1.5 text-center text-caption font-semibold tabular-nums"
                  :class="section.active ? 'bg-tint-soft text-content-link' : 'bg-surface-cell text-content-muted'">{{ props.counts[section.name] }}</span>
              </a>
            </RouterLink>
          </li>
        </ul>
      </nav>
    </div>

    <!-- Drill-in rows on the first section -->
    <nav v-else-if="hasNav && variant === 'rows' && onFirst" :aria-label="props.label" data-test="section-rows" class="flex flex-col gap-group-gap">
      <section v-for="group in rowGroups" :key="group.key" class="flex min-w-0 flex-col">
        <h3 v-if="group.header" class="px-row-inset pb-2 text-subheadline font-semibold text-content-strong compact:text-footnote compact:font-normal compact:uppercase compact:tracking-wide compact:text-content-muted">{{ group.header }}</h3>
        <ul class="overflow-hidden rounded-group bg-surface-cell shadow-group">
          <li v-for="section in group.sections" :key="section.name" class="[&:first-child_.row-body]:border-t-0">
            <RouterLink :to="section.to" :data-test="`section-${section.name}`"
              class="flex min-w-0 items-stretch gap-3 pl-row-inset transition-colors duration-motion-fast hover:bg-fill focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus">
              <span class="flex shrink-0 items-center"><IconTile tone="anchor" :icon="section.icon" /></span>
              <span class="row-body flex min-h-row min-w-0 flex-1 items-center gap-2 border-t border-border-separator py-2 pr-row-inset">
                <span class="min-w-0 flex-1 break-words text-body text-content-strong">{{ section.label }}</span>
                <span v-if="props.counts[section.name] !== undefined" class="text-body tabular-nums text-content-muted">{{ props.counts[section.name] }}</span>
                <Icon name="arrowRightSLine" :size="18" class="shrink-0 text-content-disabled" />
              </span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </nav>

    <!-- The wrappers stay mounted either way (`contents`), so the routed page never remounts when its sections register and the aside appears. -->
    <div :class="stepsAside ? 'grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,14rem)] items-start gap-7' : 'contents'" :data-test="stepsAside ? 'section-steps-form' : undefined">
      <div :class="stepsAside ? 'min-w-0' : 'contents'"><slot /></div>
      <aside v-if="stepsAside" class="sticky top-[calc(var(--app-bar-height)+1rem+var(--shell-banner-h,0px))] min-w-0 self-start"><SectionList standalone /></aside>
    </div>

    <!-- A long page's own sections on compact screens: the floating jumper. -->
    <SectionJumper v-if="!wide && index.sections.value.length > 2" />
  </div>
</template>
