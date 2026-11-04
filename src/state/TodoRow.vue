<script setup lang="ts">
import type { TodoRowAction, TodoRowState } from "./todoRow";
import { Icon } from "../icon";
import { FormRow } from "../form";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { RouteLocationRaw } from "vue-router";

/**
 * TodoRow — one to-do of a workflow record (VEHICLE_WORKFLOW_PLAN W2, variant A; prototype
 * `UvPreparationADesktop`): its state as the leading mark, the label, a one-line state under
 * it, and either a drill-in to the screen that does it (`to`), one trailing action that
 * opens a sheet ("Ispuni", "Preuzmi"), or a control in the `trailing` slot that does it in
 * place (a location picker). Rows go in a `FormGroup`.
 *
 * | state | Mark |
 * |---|---|
 * | `done` | filled check |
 * | `missing` | red cross — or, with `step`, the current step's tinted number; a row that does not block the next phase (`blocking: false`) gets an amber ring and plain text instead |
 * | `waiting` | dashed circle (with `step`, its number): it waits for an earlier row |
 * | `optional` | dashed circle: nothing there, and nothing expects it |
 */

const props = withDefaults(defineProps<{
  state: TodoRowState;
  label: string;
  sub?: string;
  /** The row's step in an ordered group ("Put do kupca · korak 2 od 3"). */
  step?: number;
  to?: RouteLocationRaw;
  /** A trailing action instead of the drill-in; the row itself stays plain. */
  action?: TodoRowAction;
  /** A trailing action beside the drill-in: the row still opens `to`, this does not navigate. */
  print?: TodoRowAction;
  /** A quiet trailing value (a count, an amount). */
  value?: string;
  /** Whether a missing row stands before the next phase; a tracked one is not an error. */
  blocking?: boolean;
}>(), { sub: undefined, step: undefined, to: undefined, action: undefined, print: undefined, value: undefined, blocking: true });

const { t } = useI18n();

const current = computed(() => props.state === "missing" && props.step !== undefined);
const error = computed(() => props.state === "missing" && !current.value && props.blocking);
const stateLabel = computed(() => t(`core.todo_state.${props.state}`));
</script>

<template>
  <FormRow :label="props.label" layout="setting" :to="props.action || $slots.trailing ? undefined : props.to" v-bind="{ 'data-todo-state': props.state }">
    <template #leading>
      <span v-if="props.state === 'done'" aria-hidden="true" class="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-control-on text-white compact:size-7">
        <Icon name="checkCustom" :size="12" />
      </span>
      <span v-else-if="current" aria-hidden="true" class="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-tint text-caption font-semibold text-content-on-tint compact:size-7">{{ props.step }}</span>
      <span v-else-if="error" aria-hidden="true" class="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-status-danger-surface text-status-danger-content compact:size-7">
        <Icon name="close" :size="12" />
      </span>
      <span v-else-if="props.state === 'missing'" aria-hidden="true" data-todo-tracked
        class="flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 border-status-warning-content/60 compact:size-7" />
      <span v-else aria-hidden="true" class="flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 border-dashed border-fill-strong text-caption font-semibold text-content-muted compact:size-7">{{ props.step ?? "" }}</span>
    </template>
    <template #sub>
      <span v-if="props.sub" :class="error ? 'text-status-danger-content' : ''">{{ props.sub }}</span>
      <span class="sr-only"> ({{ stateLabel }})</span>
    </template>
    <span v-if="props.value" class="text-body tabular-nums text-content-muted">{{ props.value }}</span>
    <template v-if="$slots.trailing || props.action || props.print" #trailing>
      <slot v-if="$slots.trailing" name="trailing" />
      <button v-else-if="props.action || props.print" type="button" :data-test="(props.action ?? props.print)!.testId"
        :aria-label="(props.action ?? props.print)!.ariaLabel"
        class="hit-target relative text-body text-content-link focus-visible:outline-2 focus-visible:outline-border-focus"
        @click.prevent.stop="(props.action ?? props.print)!.onClick()">
        {{ (props.action ?? props.print)!.label }}
      </button>
    </template>
  </FormRow>
</template>
