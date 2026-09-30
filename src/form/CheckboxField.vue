<script setup lang="ts">
import { useId } from "vue";
import { Icon } from "../icon";
import { useFormGroup } from "./field";

/**
 * One checkable option: a check circle, a title, an optional description (an equipment price). The whole row is
 * the target. Put several in a `FormGroup` for a checklist (`variant="row"`: row metrics and an inset separator
 * that starts at the text, a `#trailing` slot for a price, a code or a lock). The value is a boolean.
 *
 *   <FormGroup><CheckboxField v-bind="form.bind('abs')" variant="row" label="ABS" description="+ 120 EUR" /></FormGroup>
 *
 * It is the option itself, not a labelled field: for a setting with a label column use `SwitchField`.
 */
const props = withDefaults(defineProps<{
  label: string;
  description?: string;
  disabled?: boolean;
  variant?: "inline" | "row";
  /** The message to show; `form.bind()` supplies it. */
  error?: string;
}>(), { description: undefined, disabled: false, variant: "inline", error: undefined });

const model = defineModel<boolean>({ default: false });
defineSlots<{ default?: () => unknown; trailing?: () => unknown }>();

const inGroup = !!useFormGroup();
const id = useId();
const toggle = () => {
  if (!props.disabled) model.value = !model.value;
};
</script>

<template>
  <div :data-field-error="props.error ? 'true' : undefined">
    <div role="checkbox" :aria-checked="model" :aria-disabled="props.disabled || undefined" :aria-describedby="props.error ? `${id}-error` : undefined" :aria-invalid="props.error ? true : undefined"
      :tabindex="props.disabled ? -1 : 0" data-test="checkbox" class="group/check flex items-center transition-colors duration-motion-fast focus-visible:outline-2 focus-visible:outline-border-focus"
      :class="[props.variant === 'row' ? 'gap-3 pl-row-inset focus-visible:-outline-offset-2' : 'gap-2.5 rounded-control px-2 py-1.5 focus-visible:outline-offset-1', inGroup && props.variant === 'row' ? 'first:rounded-t-group last:rounded-b-group' : '', props.disabled ? 'cursor-not-allowed' : props.variant === 'row' ? 'cursor-pointer hover:bg-fill/60 active:bg-fill' : 'cursor-pointer hover:bg-fill']"
      @click="toggle" @keydown.space.prevent="toggle" @keydown.enter.prevent="toggle">
      <span class="flex shrink-0 items-center justify-center rounded-full border-2" :class="[props.variant === 'row' ? 'size-5.5' : 'size-5', model ? (props.disabled ? 'border-content-disabled bg-content-disabled text-white' : 'border-control-on bg-control-on text-white') : 'border-border-control']" aria-hidden="true">
        <Icon v-if="model" name="checkCustom" :size="12" />
      </span>
      <div class="flex min-w-0 flex-1 items-center gap-3" :class="props.variant === 'row' ? 'min-h-row border-t border-border-separator py-2 pr-row-inset group-first/check:border-t-0' : ''">
        <div class="flex min-w-0 flex-1 flex-col items-start">
          <p class="w-full text-body" :class="[props.variant === 'row' ? 'break-words' : 'truncate', props.disabled ? 'text-content-muted' : model ? 'text-content-strong' : 'text-content']">{{ props.label }}</p>
          <p v-if="props.description" class="tabular-nums text-content-muted" :class="props.variant === 'row' ? 'text-footnote' : 'text-xs'">{{ props.description }}</p>
          <slot />
        </div>
        <div v-if="$slots.trailing" class="flex shrink-0 items-center gap-2.5"><slot name="trailing" /></div>
      </div>
    </div>
    <p v-if="props.error" :id="`${id}-error`" role="alert" class="flex items-start gap-1.5 px-2 pt-1 text-footnote text-content-destructive"><Icon name="alertTriangle" :size="14" class="mt-px shrink-0" /> {{ props.error }}</p>
  </div>
</template>
