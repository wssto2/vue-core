<script setup lang="ts">
import { Icon } from "../icon";
import { Sheet } from "../modal";
import { computed, useTemplateRef } from "vue";
import { RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";
import { useMediaQuery } from "../internal/mediaQuery";
import PhaseTrack from "./PhaseTrack.vue";
import type { PhaseTile } from "./phaseTile";

/**
 * PhaseTiles — where a workflow record stands among its phases (VEHICLE_WORKFLOW_PLAN W2,
 * variant A; prototype `UvPreparationADesktop`, `UvPreparationAPhone`).
 *
 * | Width | Presentation |
 * |---|---|
 * | ≥ 64rem | One tile per phase: ✓ or its number, the label, a one-line state under it (a date, what is missing); the current phase tinted |
 * | < 64rem | A card: a segmented bar, "Faza 3 od 6", the current phase and its state; tapping it lists every phase in a sheet |
 *
 * Tiles are status, not navigation: only a tile with `to` is a link (the appraisal a vehicle
 * came from). The steps' look matches SectionNavigator's `steps` variant.
 */
const props = defineProps<{
  /** Accessible name of the list ("Faze vozila"). */
  label: string;
  phases: PhaseTile[];
}>();

const { t } = useI18n();
const wide = useMediaQuery("(min-width: 64rem)");
const panel = useTemplateRef<InstanceType<typeof Sheet>>("panel");

const currentIndex = computed(() => {
  const index = props.phases.findIndex((phase) => phase.state === "current");
  return index < 0 ? props.phases.length : index;
});
const current = computed(() => props.phases[currentIndex.value]);

const TONE: Record<NonNullable<PhaseTile["tone"]>, string> = {
  warning: "text-status-warning-content",
  danger: "text-status-danger-content",
  success: "text-status-success-content",
};
const subClass = (phase: PhaseTile) => (phase.tone ? TONE[phase.tone] : "text-content-muted");
const stateLabel = (phase: PhaseTile) =>
  phase.state === "done" ? t("core.phase_tiles.done")
    : phase.state === "current" ? t("core.phase_tiles.current")
      : phase.state === "skipped" ? t("core.phase_tiles.skipped") : "";

const segment = (phase: PhaseTile) =>
  phase.state === "done" ? "bg-control-on" : phase.state === "current" ? "bg-tint" : "bg-fill-strong";
</script>

<template>
  <nav v-if="wide" :aria-label="props.label" data-test="phase-tiles">
    <ol class="flex gap-2.5">
      <li v-for="(phase, index) in props.phases" :key="phase.key" class="flex min-w-0 flex-1">
        <component :is="phase.to ? RouterLink : 'div'" :to="phase.to" :data-test="`phase-tile-${phase.key}`" :data-state="phase.state"
          :aria-current="phase.state === 'current' ? 'step' : undefined"
          class="flex min-w-0 flex-1 flex-col gap-1 rounded-group px-4 py-3"
          :class="[
            phase.state === 'current' ? 'bg-tint-soft ring-2 ring-inset ring-tint' : 'bg-surface-cell shadow-group',
            phase.to ? 'transition-colors duration-motion-fast hover:bg-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus' : '',
          ]">
          <span class="flex min-w-0 items-center gap-2.5">
            <span v-if="phase.state === 'done'" aria-hidden="true" class="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-control-on text-white">
              <Icon name="checkCustom" :size="14" />
            </span>
            <span v-else aria-hidden="true" class="flex size-6.5 shrink-0 items-center justify-center rounded-full text-footnote font-semibold"
              :class="phase.state === 'current' ? 'bg-tint text-content-on-tint' : phase.state === 'skipped' ? 'border-2 border-dashed border-fill-strong text-content-muted' : 'text-content-muted ring-2 ring-inset ring-fill-strong'">{{ index + 1 }}</span>
            <span class="truncate text-headline" :class="phase.state === 'later' || phase.state === 'skipped' ? 'font-medium text-content-muted' : 'font-semibold text-content-strong'">{{ phase.label }}</span>
          </span>
          <span class="truncate text-footnote" :class="subClass(phase)" data-test="phase-tile-sub">{{ phase.sub || "—" }}</span>
          <span class="sr-only">{{ stateLabel(phase) }}</span>
        </component>
      </li>
    </ol>
  </nav>

  <template v-else>
    <button type="button" data-test="phase-tiles-compact"
      :aria-label="`${t('core.phase_tiles.position', { current: currentIndex + 1, total: props.phases.length })} · ${current?.label ?? ''}`"
      class="flex w-full items-center gap-3 rounded-group bg-surface-cell px-row-inset py-3 text-left shadow-group transition-colors duration-motion-fast active:bg-fill"
      @click="panel?.present()">
      <span class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="mb-1.5 flex gap-1" aria-hidden="true">
          <span v-for="phase in props.phases" :key="phase.key" class="h-1.5 flex-1 rounded-full" :class="segment(phase)" />
        </span>
        <span class="text-footnote text-content-muted">{{ t("core.phase_tiles.position", { current: currentIndex + 1, total: props.phases.length }) }}</span>
        <span class="truncate text-title font-semibold text-content-strong">{{ current?.label }}</span>
        <span v-if="current?.sub" class="truncate text-footnote" :class="subClass(current)">{{ current.sub }}</span>
      </span>
      <Icon name="arrowRightSLine" :size="18" class="shrink-0 text-content-disabled" />
    </button>
    <Sheet ref="panel" :title="props.label">
      <PhaseTrack orientation="vertical" :steps="props.phases.map((phase) => ({ label: phase.label, subtitle: phase.sub }))" :current-step="currentIndex" />
    </Sheet>
  </template>
</template>
