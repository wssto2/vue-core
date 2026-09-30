<script setup lang="ts">
import { computed, provide, useTemplateRef } from "vue";
import { formEditableKey } from "./field";
import FormErrors from "./FormErrors.vue";
import type { Form } from "./useForm";

/**
 * The `<form>` around a form's groups and fields: Enter submits, read mode and the failure banner are set once.
 *
 *   <FormView :form="form" :editable="editing" @submit="save">
 *     <FormGroup :header="t('contact')">…</FormGroup>
 *   </FormView>
 *
 * `editable="false"` reads the whole form (value rows); a group can still differ (`FormGroup :editable`).
 * A submit while `form.submitting` is ignored. The banner tells why the last submit failed and lists the
 * errors that have no field on screen (see `FormErrors`).
 */
const props = withDefaults(defineProps<{
  form?: Pick<Form<object>, "failure" | "errors" | "unplaced" | "submitting">;
  editable?: boolean;
  /** The name of a field for people, for the errors that have no field on screen. */
  fieldLabel?: (field: string) => string;
}>(), { form: undefined, editable: true, fieldLabel: undefined });

const emit = defineEmits<{ submit: [] }>();
defineSlots<{ default?: () => unknown }>();

provide(formEditableKey, computed(() => props.editable));
const root = useTemplateRef<HTMLElement>("root");

function onSubmit() {
  if (props.form?.submitting.value || !props.editable) return;
  emit("submit");
}
</script>

<template>
  <form ref="root" class="flex min-w-0 flex-col gap-group-gap" novalidate @submit.prevent="onSubmit">
    <FormErrors v-if="props.form" :form="props.form" :label="props.fieldLabel" :scope="root" />
    <slot />
  </form>
</template>
