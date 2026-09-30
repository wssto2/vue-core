<script setup lang="ts">
import FormGroup from "./FormGroup.vue";
import FormRow from "./FormRow.vue";

/**
 * A centred action in a group of its own, iOS style: "Choose another way to enter", and (`tone="critical"`,
 * last in a sheet) "Delete".
 */
const props = withDefaults(defineProps<{ label: string; tone?: "tint" | "critical"; disabled?: boolean }>(), { tone: "tint", disabled: false });
const emit = defineEmits<{ click: [] }>();
</script>

<template>
  <FormGroup>
    <FormRow layout="stacked">
      <button type="button" :disabled="props.disabled" class="w-full py-1 text-center text-body focus-visible:outline-2 focus-visible:outline-border-focus disabled:text-content-disabled"
        :class="props.tone === 'critical' ? 'text-content-destructive' : 'text-content-link'" @click="emit('click')">
        {{ props.label }}
      </button>
    </FormRow>
  </FormGroup>
</template>
