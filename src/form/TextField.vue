<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { controlWidth, type ControlWidth } from "../controls";
import { useControlSurface } from "./control";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, useFormGroup, type FieldProps } from "./field";

/**
 * A line of text: a name, an e-mail address, a code. The value is always a string ("" is empty); a nullable
 * column is mapped to and from "" where the record is mapped (`toValues`, the payload), not guessed here.
 *
 *   <TextField v-bind="form.bind('email')" type="email" :label="t('email')" required />
 *   <TextField v-bind="form.bind('vin')" mono suffix="VIN" :label="t('vin')" />
 *
 * `mono` is for codes read character by character (0 and O, 1 and l); `prefix` and `suffix` are plain text
 * (a unit, an @) inside the control; `width` is the filled control's width in a row on wide screens.
 */
const props = withDefaults(
  defineProps<FieldProps & {
    type?: "text" | "email" | "tel" | "url" | "password" | "search";
    placeholder?: string;
    maxLength?: number;
    autocomplete?: string;
    mono?: boolean;
    prefix?: string;
    suffix?: string;
    /** sm 10rem · md 18rem (default) · lg 22rem · full (to the row's edge). */
    width?: Exclude<ControlWidth, "content">;
  }>(),
  { ...fieldDefaults, type: "text", placeholder: undefined, maxLength: undefined, autocomplete: undefined, mono: false, prefix: undefined, suffix: undefined, width: "md" },
);

const model = defineModel<string>({ default: "" });
const input = useTemplateRef<HTMLInputElement>("input");
const inRow = !!useFormGroup();
const surface = useControlSurface("text", () => (props.error ? "error" : props.disabled ? "locked" : "rest"));
const fieldWidth = computed(() => (inRow ? controlWidth(props.width) : "w-full"));

defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
  <Field v-slot="{ id, describedby, invalid }" v-bind="fieldProps(props)" :value="model" :prefix="props.prefix" :suffix="props.suffix" :value-style="props.mono ? 'mono' : undefined">
    <div class="flex items-center gap-1.5" :class="[surface, fieldWidth]">
      <span v-if="props.prefix" class="shrink-0 text-footnote text-content-muted">{{ props.prefix }}</span>
      <input :id="id" ref="input" v-model="model" :type="props.type" :name="props.name" :placeholder="props.placeholder" :maxlength="props.maxLength" :autocomplete="props.autocomplete"
        :disabled="props.disabled" :required="props.required" :aria-required="props.required || undefined" :aria-invalid="invalid || undefined" :aria-describedby="describedby"
        class="block w-full min-w-0 border-0 bg-transparent px-0 py-1 text-body text-content-strong placeholder:text-content-disabled focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
        :class="[props.mono ? 'font-mono' : '', inRow ? 'compact:text-right' : '']" />
      <span v-if="props.suffix" class="shrink-0 text-footnote text-content-muted">{{ props.suffix }}</span>
    </div>
  </Field>
</template>
