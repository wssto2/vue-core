<script setup lang="ts">
import { Comment, computed, type VNode } from "vue";
import { controlSurface } from "./controlSurface";

/**
 * The compact date (or date and time) trigger of a grouped row: the formatted value on a quiet
 * fill, tinted with a focus ring while its picker is open. Formatting and the picker belong to
 * the owner.
 *
 *   <DateButton :expanded="open" @click="open = true">14. 3. 1984.</DateButton>
 */
const props = withDefaults(defineProps<{
  expanded?: boolean;
  disabled?: boolean;
  /** The danger fill and ring of an invalid row control. */
  invalid?: boolean;
  /** Shown muted when the slot is empty. */
  placeholder?: string;
}>(), {
  expanded: false,
  disabled: false,
  invalid: false,
  placeholder: undefined,
});

const emit = defineEmits<{ click: [event: MouseEvent] }>();
const slots = defineSlots<{ default?: () => VNode[] }>();

// The row control surface (fill, focus ring, error) shared with text fields and selects; the
// capsule keeps its fill on compact screens.
const surface = computed(() => controlSurface({ kind: "date", state: props.invalid ? "error" : "rest" }));

// Owners pass `<template v-if="value">`: with no value the slot still exists but renders only
// a comment, so the placeholder must check what it renders.
function hasContent(): boolean {
  return (slots.default?.() ?? []).some((node) => node.type !== Comment);
}
</script>

<template>
  <button type="button" :disabled="props.disabled" aria-haspopup="dialog" :aria-expanded="props.expanded"
    :aria-invalid="props.invalid || undefined"
    class="hit-target inline-flex max-w-full items-center whitespace-nowrap rounded-control px-2.5 py-1 text-body tabular-nums disabled:cursor-not-allowed disabled:opacity-45"
    :class="props.expanded
      ? 'bg-tint-soft font-semibold text-content-link ring-[1.5px] ring-inset ring-border-focus transition-colors duration-motion-fast ease-motion-standard'
      : ['text-content-strong', surface]"
    @click="emit('click', $event)">
    <slot v-if="hasContent()" />
    <span v-else class="text-content-disabled">{{ props.placeholder }}</span>
  </button>
</template>
