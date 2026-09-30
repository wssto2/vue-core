<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, useFieldMode, type FieldProps } from "./field";

/**
 * An on/off setting, iOS style: the label with a switch at the row's end. The value is a boolean: a column that
 * holds 0 and 1, or "0" and "1", is mapped where the record is (`toValues`, the payload), so the switch never has
 * to guess what "off" is.
 *
 *   <SwitchField v-bind="form.bind('newsletter')" :label="t('newsletter')" :hint="t('newsletterHint')" />
 *
 * Read mode shows Yes or No. A mark that belongs to the setting (Sensitive, System) goes in `#before`.
 */
const props = withDefaults(defineProps<FieldProps & { size?: "sm" | "md" | "lg" }>(), { ...fieldDefaults, size: "md" });

const model = defineModel<boolean>({ default: false });
defineSlots<{ before?: () => unknown }>();

const { t } = useI18n();
const { editable } = useFieldMode(props);
const SIZES = {
  sm: { "--switch-w": "1.75rem", "--switch-h": "1rem" },
  md: { "--switch-w": "var(--app-switch-width)", "--switch-h": "var(--app-switch-height)" },
  lg: { "--switch-w": "3.1875rem", "--switch-h": "1.9375rem" },
};
const style = computed(() => SIZES[props.size]);

function toggle() {
  if (!props.disabled && editable.value) model.value = !model.value;
}
</script>

<template>
  <Field v-slot="{ id, describedby, invalid }" v-bind="fieldProps(props)" :value="model" row-layout="setting">
    <div class="flex items-center gap-2">
      <slot name="before" />
      <button :id="id" type="button" role="switch" :aria-checked="model" :aria-label="props.label" :aria-describedby="describedby" :aria-invalid="invalid || undefined" :disabled="props.disabled"
        :style="style" class="switch-track hit-target relative inline-flex shrink-0 cursor-pointer rounded-full transition-colors duration-motion-fast ease-motion-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:cursor-not-allowed disabled:opacity-45"
        :class="model ? 'bg-control-on' : 'bg-fill-strong'" @click="toggle">
        <span class="switch-knob pointer-events-none absolute left-0.5 top-0.5 rounded-full bg-white shadow-knob" />
        <span class="sr-only">{{ model ? t("core.form.yes") : t("core.form.no") }}</span>
      </button>
    </div>
  </Field>
</template>

<style scoped>
.switch-track {
  width: var(--switch-w);
  height: var(--switch-h);
}
.switch-knob {
  width: calc(var(--switch-h) - 0.25rem);
  height: calc(var(--switch-h) - 0.25rem);
  transition: transform var(--app-motion-normal) var(--app-motion-standard-easing);
}
.switch-track[aria-checked="true"] .switch-knob {
  transform: translateX(calc(var(--switch-w) - var(--switch-h)));
}
</style>
