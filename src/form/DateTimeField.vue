<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { useFormat } from "../format";
import { useControlSurface } from "./control";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, type FieldProps } from "./field";

/**
 * A calendar day and a time on the clock of the user, without a zone: `"2026-09-30T14:30"`, or `null`. The browser's own
 * control, like `DateField`; turning this wall-clock time into an instant (or back) is the feature's mapping.
 *
 *   <DateTimeField v-bind="form.bind('deliveryAt')" :label="t('deliveryAt')" />
 */
const props = withDefaults(defineProps<FieldProps & { min?: string; max?: string }>(), { ...fieldDefaults, min: undefined, max: undefined });

const model = defineModel<string | null>({ default: null });
const format = useFormat();
const input = useTemplateRef<HTMLInputElement>("input");
const surface = useControlSurface("date", () => (props.error ? "error" : props.disabled ? "locked" : "rest"));
const shown = computed(() => (model.value ? format.dateTime(model.value) : null));

defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
  <Field v-slot="{ id, describedby, invalid }" v-bind="fieldProps(props)" :value="shown" value-style="numeric">
    <div class="inline-flex max-w-full" :class="surface">
      <input :id="id" ref="input" type="datetime-local" step="60" :name="props.name" :value="model ?? ''" :min="props.min" :max="props.max" :disabled="props.disabled" :required="props.required"
        :aria-required="props.required || undefined" :aria-invalid="invalid || undefined" :aria-describedby="describedby"
        class="block min-h-7 min-w-0 border-0 bg-transparent px-2.5 py-1 text-body tabular-nums text-content-strong focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
        @input="model = ($event.target as HTMLInputElement).value || null" />
    </div>
  </Field>
</template>
