<script setup lang="ts">
import { Icon } from "../icon";
import { Sheet } from "../modal";
import { computed, useTemplateRef } from "vue";
import { useMediaQuery } from "../internal/mediaQuery";
import { useI18n } from "vue-i18n";
import type { PhaseStep } from "./phaseStep";

/**
 * PhaseTrack — where a record stands in its process (Emerald Native, plan
 * phase F; prototype `phaseTrack` / `leadTimelineCard`).
 *
 *   <phase-track :title="t('…phase')" :steps="steps" :current-step="1" compact-on-mobile />
 *
 * Desktop: a grouped card with a horizontal track — done steps are filled
 * control-on circles with a check, the current step is a ring in the tint (or
 * the phase's status tone), later steps are hollow. `orientation="vertical"` is
 * the timeline card, and what a horizontal track becomes on a phone. Below
 * 1024px with `compactOnMobile`: one summary row
 * ("Korak 2 od 5 · Priprema") with a segmented bar that opens the vertical
 * timeline in a sheet.
 */
export type PhaseTone = "tint" | "info" | "warning" | "danger" | "neutral";

const props = withDefaults(defineProps<{
  steps: PhaseStep[];
  /** 0-based index of the current step; `steps.length` or more means all done. */
  currentStep: number;
  /** Card header ("Faza vozila"); the step counter sits next to it. */
  title?: string;
  /** Colour of the current step: the tint, or the phase's status tone (lead phases). */
  currentTone?: PhaseTone;
  orientation?: "horizontal" | "vertical";
  /** Below 1024px, a summary row + segmented bar that opens the timeline in a sheet. */
  compactOnMobile?: boolean;
  /** Colours the final step once every step is done (e.g. bought / rejected). */
  outcome?: "success" | "danger" | null;
}>(), {
  title: undefined,
  currentTone: "tint",
  orientation: "horizontal",
  compactOnMobile: false,
  outcome: null,
});

const { t } = useI18n();

// Same touch breakpoint as Tabs, DetailNav and CollectionTable.
const isNarrow = useMediaQuery("(max-width: 1023px)");
const compact = computed(() => props.compactOnMobile && isNarrow.value);
// A horizontal track cannot fit a phone: without the compact summary it turns into the timeline.
const isPhone = useMediaQuery("(max-width: 47.999rem)");
const layout = computed(() => (props.orientation === "horizontal" && isPhone.value ? "vertical" : props.orientation));

const allDone = computed(() => props.currentStep >= props.steps.length);
/** The step the summary names: the current one, or the last once all are done. */
const summaryIndex = computed(() => Math.min(Math.max(props.currentStep, 0), props.steps.length - 1));
const counter = computed(() => t("core.stepper.step_of", { current: summaryIndex.value + 1, total: props.steps.length }));

type StepState = "completed" | "active" | "pending" | "success" | "danger";

function stepState(index: number): StepState {
  if (allDone.value && props.outcome && index === props.steps.length - 1) return props.outcome;
  if (index < props.currentStep) return "completed";
  if (index === props.currentStep) return "active";
  return "pending";
}

// Written out in full so Tailwind generates every class.
const TONES: Record<PhaseTone, { ring: string; fill: string; text: string }> = {
  tint: { ring: "border-tint", fill: "bg-tint", text: "text-content-link" },
  info: { ring: "border-status-info-content", fill: "bg-status-info-content", text: "text-status-info-content" },
  warning: { ring: "border-status-warning-content", fill: "bg-status-warning-content", text: "text-status-warning-content" },
  danger: { ring: "border-status-danger-content", fill: "bg-status-danger-content", text: "text-status-danger-content" },
  neutral: { ring: "border-status-neutral-content", fill: "bg-status-neutral-content", text: "text-status-neutral-content" },
};
const tone = computed(() => TONES[props.currentTone]);

function segmentClass(index: number): string {
  const state = stepState(index);
  if (state === "danger") return "bg-status-danger-solid";
  if (state === "completed" || state === "success") return "bg-control-on";
  if (state === "active") return tone.value.fill;
  return "bg-fill-strong";
}

function stateLabel(index: number): string {
  const state = stepState(index);
  if (state === "active") return t("core.stepper.current");
  if (state === "pending") return "";
  return t("core.stepper.completed");
}

const historySheet = useTemplateRef<InstanceType<typeof Sheet>>("historySheet");
</script>

<template>
  <template v-if="compact">
    <button type="button" data-test="progress-stepper-compact" :aria-label="`${t('core.stepper.history')}: ${counter} · ${steps[summaryIndex]?.label ?? ''}`"
      class="flex w-full cursor-pointer items-center gap-3 rounded-group bg-surface-cell px-row-inset py-3 text-left shadow-group transition-colors duration-motion-fast active:bg-fill"
      @click="historySheet?.present()">
      <span class="flex min-w-0 flex-1 flex-col gap-2">
        <span class="min-w-0 truncate">
          <span class="text-subheadline text-content-muted">{{ counter }} · </span>
          <span class="text-headline font-semibold text-content-strong">{{ steps[summaryIndex]?.label }}</span>
        </span>
        <span class="flex gap-1" aria-hidden="true">
          <span v-for="(_step, index) in steps" :key="index" class="h-1.5 flex-1 rounded-full" :class="segmentClass(index)"></span>
        </span>
      </span>
      <Icon name="arrowRightSLine" :size="18" class="shrink-0 text-content-disabled" />
    </button>

    <Sheet ref="historySheet" :title="title ?? t('core.stepper.history')">
      <ol class="flex flex-col" data-test="progress-stepper-history">
        <li v-for="(step, index) in steps" :key="index" class="relative flex gap-3 pb-4 last:pb-0"
          :aria-current="stepState(index) === 'active' ? 'step' : undefined" :data-state="stepState(index)">
          <span v-if="index < steps.length - 1" aria-hidden="true" class="absolute top-6 bottom-0 left-[11px] w-0.5"
            :class="stepState(index) === 'completed' ? 'bg-control-on' : 'bg-fill-strong'"></span>
          <span aria-hidden="true" class="relative flex size-6 shrink-0 items-center justify-center rounded-full" :class="{
            'bg-control-on text-white': stepState(index) === 'completed' || stepState(index) === 'success',
            'bg-status-danger-solid text-white': stepState(index) === 'danger',
            [`border-[2.5px] bg-surface-cell ${tone.ring}`]: stepState(index) === 'active',
            'border-2 border-fill-strong': stepState(index) === 'pending',
            'border-dashed': stepState(index) === 'pending' && step.dashed,
          }">
            <Icon v-if="stepState(index) === 'danger'" name="close" :size="14" />
            <Icon v-else-if="stepState(index) !== 'active' && stepState(index) !== 'pending'" name="checkCustom" :size="14" />
          </span>
          <span class="flex min-w-0 flex-col gap-px pt-0.5">
            <span class="text-body" :class="stepState(index) === 'active' ? 'font-semibold text-content-strong' : stepState(index) === 'pending' ? 'text-content-muted' : 'font-medium text-content-strong'">
              {{ step.label }}<span v-if="stateLabel(index)" class="sr-only"> ({{ stateLabel(index) }})</span>
            </span>
            <span v-if="step.subtitle" class="text-footnote tabular-nums" :class="stepState(index) === 'active' ? tone.text : 'text-content-muted'">{{ step.subtitle }}</span>
          </span>
        </li>
      </ol>
    </Sheet>
  </template>

  <section v-else data-test="phase-track" :data-orientation="layout"
    class="flex min-w-0 flex-col gap-4 rounded-group bg-surface-cell px-5 pt-4 pb-5 shadow-group">
    <header v-if="title" class="flex items-center gap-3">
      <h3 class="min-w-0 flex-1 text-subheadline font-semibold text-content-strong">{{ title }}</h3>
      <slot name="header-trailing">
        <span class="shrink-0 text-footnote text-content-muted">{{ counter }}</span>
      </slot>
    </header>

    <!-- Vertical timeline -->
    <ol v-if="layout === 'vertical'" class="flex flex-col" :aria-label="title ?? t('core.stepper.history')">
      <li v-for="(step, index) in steps" :key="index" class="relative flex gap-3 pb-3.5 last:pb-0"
        :aria-current="stepState(index) === 'active' ? 'step' : undefined" :data-state="stepState(index)">
        <span v-if="index < steps.length - 1" aria-hidden="true" class="absolute top-5 bottom-0 left-[9px] w-0.5"
          :class="stepState(index) === 'completed' ? 'bg-control-on' : 'bg-fill-strong'"></span>
        <span aria-hidden="true" class="relative mt-px flex size-5 shrink-0 items-center justify-center rounded-full" :class="{
          'bg-control-on text-white': stepState(index) === 'completed' || stepState(index) === 'success',
          'bg-status-danger-solid text-white': stepState(index) === 'danger',
          [`border-[2.5px] bg-surface-cell ${tone.ring}`]: stepState(index) === 'active',
          'border-2 border-fill-strong': stepState(index) === 'pending',
          'border-dashed': stepState(index) === 'pending' && step.dashed,
        }">
          <Icon v-if="stepState(index) === 'danger'" name="close" :size="12" />
          <Icon v-else-if="stepState(index) !== 'active' && stepState(index) !== 'pending'" name="checkCustom" :size="12" />
        </span>
        <span class="flex min-w-0 flex-col gap-px">
          <span class="text-body" :class="stepState(index) === 'active' ? 'font-semibold text-content-strong' : stepState(index) === 'pending' ? 'text-content-muted' : 'font-medium text-content-strong'">
            {{ step.label }}<span v-if="stateLabel(index)" class="sr-only"> ({{ stateLabel(index) }})</span>
          </span>
          <span v-if="step.subtitle" class="text-footnote tabular-nums" :class="stepState(index) === 'active' ? tone.text : 'text-content-muted'">{{ step.subtitle }}</span>
        </span>
      </li>
    </ol>

    <!-- Horizontal track -->
    <ol v-else class="flex w-full min-w-0 items-start" :aria-label="title ?? t('core.stepper.history')">
      <li v-for="(step, index) in steps" :key="index" class="relative flex min-w-0 flex-1 flex-col items-start gap-2.5"
        :aria-current="stepState(index) === 'active' ? 'step' : undefined" :data-state="stepState(index)">
        <span v-if="index < steps.length - 1" aria-hidden="true" class="absolute top-[13px] right-1.5 left-[34px] h-0.5 rounded-full"
          :class="stepState(index) === 'completed' ? 'bg-control-on' : 'bg-fill-strong'"></span>
        <span aria-hidden="true" class="relative flex size-7 shrink-0 items-center justify-center rounded-full" :class="{
          'bg-control-on text-white': stepState(index) === 'completed' || stepState(index) === 'success',
          'bg-status-danger-solid text-white': stepState(index) === 'danger',
          [`border-[3px] bg-surface-cell ${tone.ring}`]: stepState(index) === 'active',
          'border-2 border-fill-strong bg-surface-cell': stepState(index) === 'pending',
          'border-dashed': stepState(index) === 'pending' && step.dashed,
        }">
          <span v-if="stepState(index) === 'active'" class="size-2.5 rounded-full" :class="tone.fill"></span>
          <Icon v-else-if="stepState(index) === 'danger'" name="close" :size="16" />
          <Icon v-else-if="stepState(index) !== 'pending'" name="checkCustom" :size="16" />
        </span>
        <span class="flex min-w-0 flex-col gap-0.5 pr-3">
          <span class="text-body text-pretty break-words" :class="stepState(index) === 'active' ? 'font-semibold text-content-strong' : stepState(index) === 'pending' ? 'text-content-muted' : 'font-medium text-content-strong'">
            {{ step.label }}<span v-if="stateLabel(index)" class="sr-only"> ({{ stateLabel(index) }})</span>
          </span>
          <span v-if="step.subtitle" class="text-footnote tabular-nums" :class="stepState(index) === 'active' ? tone.text : 'text-content-muted'">{{ step.subtitle }}</span>
        </span>
      </li>
    </ol>
  </section>
</template>
