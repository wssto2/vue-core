<script setup lang="ts" generic="Name extends string">
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";
import type { StepFlow } from "./steps";

/**
 * Where a step-by-step form stands. `bar` (default): one segment per step with its name, ✓ on a step that is done, the number of
 * fields in error on a step that has some, and a step already passed is a button that goes back to it: for a fixed list of named
 * steps. `dots`: one dot per step, the current one wide, for steps that depend on answers and whose names cannot be told in advance.
 * `StepForm` renders it; render it yourself where a dialog wants it in its header.
 *
 *   <Modal …><template #header><StepProgress :flow="flow" /></template>…</Modal>
 */
const props = withDefaults(defineProps<{ flow: StepFlow<Name>; progress?: "bar" | "dots" }>(), { progress: "bar" });
const { t } = useI18n();
</script>

<template>
  <ol v-if="props.progress === 'bar'" :aria-label="t('core.steps.label')" data-test="step-bar" class="grid min-w-0 gap-2"
    :style="{ gridTemplateColumns: `repeat(${props.flow.count.value}, minmax(0, 1fr))` }">
    <li v-for="step in props.flow.steps.value" :key="step.name" class="flex min-w-0" :aria-current="step.state === 'current' ? 'step' : undefined">
      <component :is="step.reachable ? 'button' : 'div'" :type="step.reachable ? 'button' : undefined" :disabled="step.reachable ? props.flow.busy.value : undefined"
        :data-test="`step-${step.name}`" :data-state="step.errors > 0 ? 'error' : step.state"
        class="group flex min-w-0 flex-1 flex-col gap-1.5 text-left"
        :class="step.reachable ? 'cursor-pointer rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:cursor-default' : ''"
        @click="step.reachable ? props.flow.goTo(step.name) : undefined">
        <span class="h-1 rounded-full transition-colors duration-motion-normal"
          :class="step.errors > 0 ? 'bg-status-danger-solid' : step.state === 'current' ? 'bg-tint' : step.state === 'done' ? 'bg-control-on' : 'bg-fill-strong'" aria-hidden="true"></span>
        <span class="flex min-w-0 items-center gap-1.5 text-footnote"
          :class="step.state === 'current' ? 'font-bold text-content-strong' : step.state === 'done' ? 'font-medium text-content-link' : 'font-medium text-content-muted'">
          <Icon v-if="step.state === 'done'" name="checkCustom" :size="12" class="shrink-0" />
          <span class="truncate" :class="step.reachable ? 'group-hover:text-content-link' : ''">{{ step.position }}. {{ step.label }}</span>
          <span v-if="step.errors > 0" data-test="step-errors" :aria-label="t('core.form.sections.errors', { count: step.errors })"
            class="min-w-4.5 shrink-0 rounded-full bg-status-danger-solid px-1.5 text-center text-caption font-semibold text-white">{{ step.errors }}</span>
          <span v-if="step.state === 'done'" class="sr-only">{{ t("core.steps.done") }}</span>
        </span>
      </component>
    </li>
  </ol>

  <!-- Dots say how far, not what: decorative, with the step in words for screen readers. -->
  <div v-else data-test="step-dots" class="flex justify-center gap-1.5" aria-hidden="true">
    <span v-for="step in props.flow.steps.value" :key="step.name" class="h-1.5 rounded-full transition-all duration-motion-fast"
      :data-state="step.errors > 0 ? 'error' : step.state"
      :class="[step.state === 'current' ? 'w-4.5' : 'w-1.5', step.errors > 0 ? 'bg-status-danger-solid' : step.state === 'todo' && step.position > props.flow.index.value ? 'bg-fill-strong' : 'bg-tint']"></span>
  </div>
</template>
