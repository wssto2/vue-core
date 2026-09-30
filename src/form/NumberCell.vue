<script setup lang="ts">
/**
 * A whole number typed in a grid cell (a planning matrix, a quantity column): the filled control at cell size, right-aligned tabular
 * digits on every width, since a grid's cell has no row to carry a label. Empty is `null`; what is typed is kept between `min` and `max`.
 * `label` is the accessible name (say the row and the column); `wide` fits an amount; `placeholder` shows what an empty cell stands for.
 *
 *   <NumberCell v-model="plan[centre][month]" :label="`${centre}, ${month}`" :max="99999" />
 *
 * It is not a labelled field: use `NumberField` in a form.
 */
const props = withDefaults(defineProps<{ label: string; min?: number; max?: number; disabled?: boolean; invalid?: boolean; wide?: boolean; placeholder?: string }>(), {
  min: 0,
  max: 9999,
  disabled: false,
  invalid: false,
  wide: false,
  placeholder: undefined,
});

const model = defineModel<number | null>({ default: null });

function onInput(event: Event) {
  const digits = (event.target as HTMLInputElement).value.replace(/\D/g, "");
  model.value = digits === "" ? null : Math.min(props.max, Math.max(props.min, Number(digits)));
}

// On leaving, the text is what the model says (a clamped or cleared entry shows as it was kept).
const settle = (event: FocusEvent) => ((event.target as HTMLInputElement).value = model.value === null ? "" : String(model.value));
</script>

<template>
  <input :value="model ?? ''" type="text" inputmode="numeric" autocomplete="off" :aria-label="props.label" :disabled="props.disabled" :aria-invalid="props.invalid || undefined" :placeholder="props.placeholder"
    class="rounded-control bg-fill px-2 py-1 text-right text-body tabular-nums text-content-strong transition-[background-color,box-shadow] duration-motion-fast ease-motion-standard placeholder:text-content-disabled focus:bg-surface-cell focus:outline-none focus:ring-[1.5px] focus:ring-inset focus:ring-border-focus disabled:opacity-45"
    :class="[props.wide ? 'w-28' : 'w-16', props.invalid ? 'bg-status-danger-surface ring-[1.5px] ring-inset ring-border-destructive' : '']" @input="onInput" @blur="settle" />
</template>
