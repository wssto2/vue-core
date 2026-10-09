<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, type RouteLocationRaw } from "vue-router";
import { Icon } from "../icon";
import { useFormRowIndent, type FormRowLayout } from "./field";

/**
 * One row of a `FormGroup`. Fields render through it by themselves; use it directly for a custom row: a
 * drill-in link, a computed value, a row with a leading icon tile.
 *
 *   <FormRow :label="t('locations')" :to="{ name: 'locations' }" value="4">
 *     <template #leading><IconTile kind="anchor" icon="mapPin" /></template>
 *   </FormRow>
 *
 * The separator lives on the body, so it starts at the text, past a leading tile (the iOS inset separator).
 */
const props = withDefaults(defineProps<{
  label?: string;
  /** The label is read by screen readers but not drawn; the row lays out as if it had none. */
  labelHidden?: boolean;
  /** The id of the control the label names (editable rows). */
  for?: string;
  /** A secondary line under the label. */
  sub?: string;
  subId?: string;
  required?: boolean;
  layout?: FormRowLayout;
  /** Read-only value for a custom value row (the slot wins). */
  value?: string | number | null;
  /** Makes the whole row a link with a chevron. */
  to?: RouteLocationRaw;
  /** Shown under the row, for a custom row (fields pass theirs). */
  error?: string;
  errorId?: string;
  /** Extra indentation levels on top of `FormIndent`. */
  indent?: number;
  /** Clamps a long label to this many lines. */
  labelLines?: 1 | 2 | 3;
  /** `top` aligns the label with the first line of a tall control (a textarea). */
  labelAlign?: "center" | "top";
}>(), {
  label: undefined,
  labelHidden: false,
  for: undefined,
  sub: undefined,
  subId: undefined,
  required: false,
  layout: "entry",
  value: undefined,
  to: undefined,
  error: undefined,
  errorId: undefined,
  indent: 0,
  labelLines: undefined,
  labelAlign: "center",
});

const slots = defineSlots<{
  default?: () => unknown;
  leading?: () => unknown;
  trailing?: () => unknown;
  /** A rich subtitle (a status colour); `sub` for plain text. */
  sub?: () => unknown;
  /** Beside the label, at the end of its line (language tabs over a stacked control). */
  "label-trailing"?: () => unknown;
}>();

const inherited = useFormRowIndent();
const level = computed(() => inherited + props.indent);

// Written out so Tailwind generates every class.
const INDENT = ["pl-row-inset", "pl-[calc(var(--app-row-inset)+1.25rem)]", "pl-[calc(var(--app-row-inset)+2.5rem)]"];
const LABEL_LINES = { 1: "line-clamp-1", 2: "line-clamp-2", 3: "line-clamp-3" } as const;

// Without a drawn label there is no label column: an entry or value row stacks its control.
const layout = computed(() => (props.labelHidden && (props.layout === "entry" || props.layout === "value") ? "stacked" : props.layout));
const bodyLayout = computed(() => {
  switch (layout.value) {
    case "entry":
      // Compact: the label takes what it needs, but the value keeps at least 40 % of the row: a long label wraps instead of squeezing the input.
      return "grid grid-cols-[var(--form-label-width,11rem)_minmax(0,1fr)] items-center gap-x-4 compact:grid-cols-[minmax(0,auto)_minmax(40%,1fr)]";
    case "value":
      // The label keeps its longest word; the value wraps beside it.
      return "grid grid-cols-[minmax(min-content,1fr)_minmax(0,auto)] items-center gap-x-4";
    case "setting":
      return "flex items-center gap-4";
    default:
      return "flex flex-col gap-1";
  }
});

const labelClass = computed(() => (props.labelHidden ? "sr-only" : layout.value === "stacked" ? "text-footnote text-content-muted" : props.layout === "value" ? "text-body text-content-muted" : "text-body text-content-strong"));
const hasValue = computed(() => props.value !== undefined && props.value !== null && props.value !== "");
</script>

<template>
  <component :is="props.to ? RouterLink : 'div'" :to="props.to" data-test="form-row" :data-layout="layout" :data-field-error="props.error ? 'true' : undefined"
    class="form-row flex min-w-0 items-stretch gap-3 transition-colors duration-motion-fast first:rounded-t-group last:rounded-b-group focus-within:bg-tint-soft/50 [&:first-child>.row-body]:border-t-0"
    :class="[INDENT[Math.min(level, 2)], props.to ? 'hover:bg-fill focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus' : '']">
    <div v-if="slots.leading" class="flex shrink-0 items-center"><slot name="leading" /></div>

    <div class="row-body min-h-row min-w-0 flex-1 border-t border-border-separator py-2 pr-row-inset">
      <div class="min-w-0" :class="bodyLayout">
        <div v-if="props.label || props.sub || slots.sub" :class="[props.labelHidden && !props.sub && !slots.sub ? 'contents' : layout === 'setting' ? 'min-w-min flex-1' : 'min-w-0', props.labelAlign === 'top' ? 'self-start pt-1' : '']">
          <div :class="slots['label-trailing'] ? 'flex items-center justify-between gap-3' : ''">
            <component :is="props.for ? 'label' : 'span'" :for="props.for" class="break-words" :class="[labelClass, props.labelHidden ? '' : props.labelLines ? LABEL_LINES[props.labelLines] : 'block']">
              {{ props.label }}<span v-if="props.required" class="text-content-destructive" aria-hidden="true"> *</span>
            </component>
            <slot name="label-trailing" />
          </div>
          <small v-if="props.sub || slots.sub" :id="props.subId" class="mt-0.5 block text-footnote text-content-muted"><slot name="sub">{{ props.sub }}</slot></small>
        </div>

        <div class="flex min-w-0 items-center gap-2" :class="layout === 'value' ? 'justify-end text-right' : layout === 'setting' ? 'flex-wrap justify-end text-right' : layout === 'entry' ? 'compact:justify-end' : ''">
          <slot>
            <span v-if="hasValue" class="break-words text-body text-content-strong">{{ props.value }}</span>
          </slot>
          <slot name="trailing" />
          <Icon v-if="props.to" name="arrowRightSLine" :size="18" class="shrink-0 text-content-disabled" />
        </div>
      </div>

      <p v-if="props.error" :id="props.errorId" class="mt-1 flex items-start gap-1.5 text-footnote text-content-destructive" role="alert">
        <Icon name="alertTriangle" :size="14" class="mt-px shrink-0" /> {{ props.error }}
      </p>
    </div>
  </component>
</template>
