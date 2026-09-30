<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { useFormat } from "../format";
import { useControlSurface } from "./control";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, type FieldProps } from "./field";

/**
 * A calendar day, without a time or a zone: `"2026-09-30"`, or `null` for none. It is the browser's own date control
 * (the keyboard entry, the picker and the order of day and month follow the device), so there is no calendar
 * widget to load, and the value is text, never a `Date`: a day cannot drift a day across time zones.
 *
 *   <DateField v-bind="form.bind('dueOn')" :label="t('dueOn')" min="2026-01-01" />
 *
 * `min` and `max` are days too (`"2026-12-31"`). An incomplete or impossible entry is `null` until it is a real day.
 */
const props = withDefaults(defineProps<FieldProps & { min?: string; max?: string }>(), { ...fieldDefaults, min: undefined, max: undefined });

const model = defineModel<string | null>({ default: null });
const format = useFormat();
const input = useTemplateRef<HTMLInputElement>("input");
const surface = useControlSurface("date", () => (props.error ? "error" : props.disabled ? "locked" : "rest"));
const shown = computed(() => (model.value ? format.date(model.value) : null));

defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
  <Field v-slot="{ id, describedby, invalid }" v-bind="fieldProps(props)" :value="shown" value-style="numeric">
    <div class="inline-flex max-w-full" :class="surface">
      <input :id="id" ref="input" type="date" :name="props.name" :value="model ?? ''" :min="props.min" :max="props.max" :disabled="props.disabled" :required="props.required" :aria-required="props.required || undefined"
        :aria-invalid="invalid || undefined" :aria-describedby="describedby"
        class="block min-h-7 min-w-0 border-0 bg-transparent px-2.5 py-1 text-body tabular-nums text-content-strong focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
        @input="model = ($event.target as HTMLInputElement).value || null" />
    </div>
  </Field>
</template>
