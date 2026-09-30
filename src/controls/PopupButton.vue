<script setup lang="ts">
import { Icon } from "../icon";

/**
 * The trigger of a choice in a grouped row: the current value with up/down chevrons. It opens
 * whatever picker the owner decides (menu, popover, sheet); it never owns the options.
 *
 *   <PopupButton :expanded="open" @click="open = true">G.</PopupButton>
 *   <PopupButton variant="plain">Customer chooses</PopupButton>      the iOS form style
 *
 * `filled` is the macOS pop-up button; `plain` is the iOS menu-picker text.
 */
const props = withDefaults(defineProps<{
  variant?: "filled" | "plain";
  expanded?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** Shown muted when there is no value. */
  placeholder?: string;
  /** What the button opens. */
  popup?: "menu" | "listbox" | "dialog";
}>(), {
  variant: "filled",
  expanded: false,
  disabled: false,
  invalid: false,
  placeholder: undefined,
  popup: "listbox",
});

const emit = defineEmits<{ click: [event: MouseEvent] }>();
const slots = defineSlots<{ default?: () => unknown }>();
</script>

<template>
  <button type="button" :disabled="props.disabled" :aria-haspopup="props.popup" :aria-expanded="props.expanded"
    :aria-invalid="props.invalid || undefined"
    class="hit-target inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-control text-body transition-colors duration-motion-fast ease-motion-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:cursor-not-allowed disabled:opacity-45"
    :class="props.variant === 'filled'
      ? ['py-1 pl-2.5 pr-2 text-content-strong', props.expanded ? 'bg-fill-strong' : 'bg-fill hover:bg-fill-strong']
      : ['py-1', props.expanded ? 'text-content-link' : 'text-content-muted hover:text-content']"
    @click="emit('click', $event)">
    <span class="min-w-0 truncate">
      <slot v-if="slots.default" />
      <span v-else class="text-content-disabled">{{ props.placeholder }}</span>
    </span>
    <Icon name="expandUpDownLine" :size="14" class="text-content-muted" />
  </button>
</template>
