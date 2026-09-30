<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, type RouteLocationRaw } from "vue-router";
import { Icon, type IconName } from "../icon";
import { useAccountMenu } from "./accountMenu";

/**
 * One row of the account menu. A feature puts its own into the menu by contributing a component
 * that renders it to the `accountMenu` slot:
 *
 *   <AccountMenuItem :label="t('profile')" icon="userLine" :to="{ name: 'profile' }" />
 *   <AccountMenuItem :label="t('darkMode')" icon="moonLine" :checked="dark" @click="toggle" />
 *
 * A row with `to` is a link, otherwise a button. Choosing it closes the menu, except `checked` (a
 * switch, `role="switch"`) and `selected` (one of several choices, `aria-current`), which stay open
 * so the change can be seen. The same rows render as a popover on desktop and a grouped sheet on phones.
 */
// `checked` and `selected` default to undefined on purpose: absent means "not a switch / not a choice",
// which a Boolean prop's implicit `false` would turn into "an off switch".
const props = withDefaults(defineProps<{
  label: string;
  icon?: IconName;
  /** Makes the row a link to a route. */
  to?: RouteLocationRaw;
  /** Makes the row a switch. */
  checked?: boolean;
  /** Makes the row a choice; the chosen one has a tick. */
  selected?: boolean;
  tone?: "critical";
}>(), { icon: undefined, to: undefined, checked: undefined, selected: undefined, tone: undefined });

const emit = defineEmits<{ click: [] }>();

const menu = useAccountMenu();
const sheet = computed(() => menu.appearance === "sheet");
const staysOpen = computed(() => props.checked !== undefined || props.selected !== undefined);
const critical = computed(() => props.tone === "critical");

const FOCUS = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus";
const POPOVER_ROW = `flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-fill ${FOCUS}`;
const SHEET_ROW = `flex min-h-row w-full cursor-pointer items-center gap-3 px-row-inset py-2 text-left text-body transition-colors duration-motion-fast active:bg-fill ${FOCUS}`;
// A hairline inset past the icon, above every row but the first of its group.
const INSET_HAIRLINE = "relative not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:left-[calc(var(--app-row-inset)+2.25rem)] not-first:before:border-t not-first:before:border-border-separator";

function choose() {
  if (!staysOpen.value) menu.close();
  emit("click");
}
</script>

<template>
  <div :class="sheet ? INSET_HAIRLINE : ''">
    <component :is="to ? RouterLink : 'button'" v-bind="to ? { to } : { type: 'button' }" :class="[sheet ? SHEET_ROW : POPOVER_ROW, critical ? 'text-content-destructive' : 'text-content-strong', sheet && critical ? 'justify-center' : '']"
      :role="checked !== undefined ? 'switch' : undefined" :aria-checked="checked" :aria-current="selected ? 'true' : undefined"
      data-account-menu-item @click="choose">
      <Icon v-if="icon && !(sheet && critical)" :name="icon" :size="sheet ? 22 : 16" class="shrink-0" :class="critical ? '' : 'text-content-muted'" />
      <span class="min-w-0 truncate" :class="sheet && critical ? '' : 'flex-1'">{{ label }}</span>
      <span v-if="checked !== undefined" aria-hidden="true" class="relative inline-flex shrink-0 rounded-full transition-colors duration-motion-fast"
        :class="[checked ? 'bg-control-on' : 'bg-fill-strong', sheet ? 'h-switch-height w-switch-width' : 'h-5 w-9']">
        <span class="absolute top-0.5 left-0.5 aspect-square h-[calc(100%-0.25rem)] rounded-full bg-white shadow-knob transition-transform duration-motion-fast"
          :class="checked ? (sheet ? 'translate-x-[calc(var(--app-switch-width)-var(--app-switch-height))]' : 'translate-x-4') : 'translate-x-0'"></span>
      </span>
      <Icon v-else-if="selected" name="checkCustom" :size="16" class="shrink-0 text-content-link" />
      <Icon v-else-if="to && sheet" name="arrowRightSLine" :size="18" class="shrink-0 text-content-disabled" />
    </component>
  </div>
</template>
