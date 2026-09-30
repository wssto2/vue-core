<script setup lang="ts">
import { computed, h, useSlots, useTemplateRef } from "vue";
import { RouterLink, type RouteLocationRaw } from "vue-router";
import { Icon, type IconName } from "../icon";
import { useWaitStatus } from "../state/useWaitStatus";
import { useKeyboardShortcut, type KeyboardShortcut } from "./shortcut";

/**
 * The one button. `prominence` says how much it asks for: `primary` for the one main action of a
 * view, `secondary` for a tinted companion, `standard` for ordinary actions, `plain` for text
 * actions in toolbars and dialogs, `link` inline in text. `tone="critical"` says what it does
 * (red, in every prominence), as SwiftUI's `Button(role: .destructive)`; it is not called `role`
 * because that would swallow the HTML `role` attribute.
 *
 *   <Button prominence="primary" icon="save" :processing="saving" @click="save">Save</Button>
 *   <Button tone="critical" prominence="plain" @click="remove">Delete</Button>
 *   <Button :to="{ name: 'lead', params: { id } }">Open</Button>          a real link (RouterLink)
 *   <Button href="tel:+385…" prominence="link">Call</Button>              a plain anchor
 *
 * Built in: a spinner in place of the icon once a wait lasted 0.3 s (the button keeps its colour
 * and width: busy, not unavailable), no click while busy or disabled (a disabled link does not
 * navigate either), a keyboard shortcut that ignores typing in fields and the page behind a dialog.
 */
const props = withDefaults(defineProps<{
  prominence?: "primary" | "secondary" | "standard" | "plain" | "link";
  tone?: "critical";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  icon?: IconName;
  trailingIcon?: IconName;
  /** Makes the button a link to a route. */
  to?: RouteLocationRaw;
  /** Makes the button a plain anchor. */
  href?: string;
  /** `submit` submits the enclosing form. Ignored for links. */
  type?: "button" | "submit";
  disabled?: boolean;
  processing?: boolean;
  keyboardShortcut?: KeyboardShortcut;
}>(), {
  prominence: "standard",
  tone: undefined,
  size: "md",
  icon: undefined,
  trailingIcon: undefined,
  to: undefined,
  href: undefined,
  type: "button",
  disabled: false,
  processing: false,
  keyboardShortcut: undefined,
});

const emit = defineEmits<{ click: [event: MouseEvent | KeyboardEvent] }>();

const slots = useSlots();
const element = useTemplateRef<HTMLElement>("element");

const wait = useWaitStatus(() => props.processing);
const inactive = computed(() => props.disabled || props.processing);

function onClick(event: MouseEvent, navigate?: (event: MouseEvent) => unknown) {
  if (inactive.value) {
    event.preventDefault();
    return;
  }
  emit("click", event);
  navigate?.(event);
}

useKeyboardShortcut(() => props.keyboardShortcut, (event) => {
  if (inactive.value || element.value?.closest("[inert]")) return false;
  emit("click", event);
});

// Written out in full so Tailwind generates every class.
const PROMINENCE = {
  primary: {
    default: "bg-tint text-content-on-tint hover:bg-tint/90 active:bg-tint/80",
    critical: "bg-status-danger-solid text-white hover:brightness-110",
  },
  secondary: {
    default: "bg-tint-soft text-content-link hover:brightness-95 dark:hover:brightness-125",
    critical: "bg-status-danger-surface text-content-destructive hover:brightness-95 dark:hover:brightness-125",
  },
  standard: {
    default: "bg-fill text-content-strong hover:bg-fill-strong",
    critical: "bg-fill text-content-destructive hover:bg-fill-strong",
  },
  plain: {
    default: "bg-transparent text-content-link hover:bg-tint-soft",
    critical: "bg-transparent text-content-destructive hover:bg-status-danger-surface",
  },
  link: {
    default: "bg-transparent text-content-link hover:underline",
    critical: "bg-transparent text-content-destructive hover:underline",
  },
} as const;

// min-h, not a fixed height: labels may wrap when text is enlarged or translated.
const SIZE = {
  xs: { box: "min-h-6 px-2.5 py-0.5 text-xs gap-1", icon: 12 },
  sm: { box: "min-h-8 px-3 py-1 text-xs gap-1.5", icon: 14 },
  md: { box: "min-h-9 px-4 py-1.5 text-sm gap-2", icon: 16 },
  lg: { box: "min-h-11 px-5 py-2 text-base gap-2", icon: 20 },
  xl: { box: "min-h-12 px-6 py-2.5 text-base gap-2.5", icon: 22 },
} as const;

const classes = computed(() => [
  "hit-target flex cursor-pointer select-none items-center justify-center rounded-button text-center font-semibold",
  "transition duration-motion-fast ease-motion-standard",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
  PROMINENCE[props.prominence][props.tone ?? "default"],
  SIZE[props.size].box,
  // aria-disabled covers links, which have no `disabled` attribute.
  props.processing && !props.disabled
    ? "cursor-progress"
    : "disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-45",
]);

const state = computed(() => ({
  "aria-disabled": inactive.value || undefined,
  "aria-busy": props.processing || undefined,
}));

// The spinner replaces the leading icon only after the wait became visible (D23).
const Content = () => [
  props.processing && wait.visible.value
    ? h(Icon, { name: "loader4Line", size: SIZE[props.size].icon, class: "animate-spin", "data-test": "button-spinner" })
    : props.icon
      ? h(Icon, { name: props.icon, size: SIZE[props.size].icon })
      : null,
  slots.default?.(),
  props.trailingIcon ? h(Icon, { name: props.trailingIcon, size: SIZE[props.size].icon }) : null,
];
</script>

<template>
  <RouterLink v-if="props.to !== undefined" :to="props.to" custom v-slot="{ href, navigate }">
    <a ref="element" :href="inactive ? undefined : href" :class="classes" v-bind="state" :tabindex="inactive ? -1 : undefined"
      @click="onClick($event, navigate)"><Content /></a>
  </RouterLink>
  <a v-else-if="props.href !== undefined" ref="element" :href="inactive ? undefined : props.href" :class="classes" v-bind="state"
    :tabindex="inactive ? -1 : undefined" @click="onClick($event)"><Content /></a>
  <button v-else ref="element" :type="props.type" :class="classes" :disabled="inactive" v-bind="state" @click="onClick($event)"><Content /></button>
</template>
