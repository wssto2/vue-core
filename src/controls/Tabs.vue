<script setup lang="ts" generic="Value extends string | number">
import { computed, inject, useId, useTemplateRef } from "vue";
import { routeLocationKey, routerKey, type RouteLocationRaw } from "vue-router";
import { Icon, type IconName } from "../icon";
import { useCompactPresentation } from "../internal/mediaQuery";

/**
 * One tab of `Tabs`. A tab with `to` navigates (and is active while that route is the current
 * one); the others select their `value`.
 */
export interface TabItem<Value extends string | number = string | number> {
  value: Value;
  label: string;
  /** One word for narrow places ("History" for "Change history"). */
  shortLabel?: string;
  icon?: IconName;
  badge?: string | number;
  /** The reason this tab needs attention; shown as an icon with this text as its name. */
  warning?: string;
  to?: RouteLocationRaw;
}

/**
 * A row of tabs over one content area: the segmented control of the design system, with a
 * `scope` presentation for a bar that filters one list (segments with count badges on wide
 * screens, one row of capsules on compact ones) and a `plain` one without the track.
 *
 *   <Tabs v-model="section" :tabs="[{ value: 'notes', label: t('notes'), badge: 3 }, …]">
 *     <NotesList v-if="section === 'notes'" />
 *   </Tabs>
 *
 * Keyboard: ←/→ (and Home/End) move between tabs and select, only the selected tab is in the
 * tab order; the default slot is the tab panel, labelled by the selected tab.
 */
const props = withDefaults(defineProps<{
  tabs: readonly TabItem<Value>[];
  presentation?: "segmented" | "plain" | "scope";
  alignment?: "start" | "center" | "end";
  /** Every tab takes an equal share of the width. */
  stretch?: boolean;
  label?: string;
}>(), {
  presentation: "segmented",
  alignment: "start",
  stretch: false,
  label: undefined,
});

const model = defineModel<Value | null>();
defineSlots<{ default?: () => unknown }>();

const id = useId();
// Optional: only a tab with `to` needs the router, and value tabs work in an app without one.
const router = inject(routerKey, null);
const route = inject(routeLocationKey, null);
function needRouter() {
  if (!router) throw new Error("Tabs: a tab has `to`, but no router is installed in the app.");
  return router;
}
const compact = useCompactPresentation();
const list = useTemplateRef<HTMLElement>("list");

const capsules = computed(() => props.presentation === "scope" && compact.value);

function isActive(tab: TabItem<Value>): boolean {
  if (tab.to !== undefined) return needRouter().resolve(tab.to).name === route?.name;
  return tab.value === model.value;
}

const active = computed(() => props.tabs.find(isActive));
const tabId = (tab: TabItem<Value>) => `${id}-tab-${String(tab.value)}`;

function select(tab: TabItem<Value>) {
  if (tab.to !== undefined) void needRouter().push(tab.to);
  else model.value = tab.value;
}

function onKeydown(event: KeyboardEvent, index: number) {
  const last = props.tabs.length - 1;
  const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: last }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  const target = props.tabs[(next + props.tabs.length) % props.tabs.length];
  if (!target) return;
  select(target);
  list.value?.querySelector<HTMLElement>(`[data-tab="${String(target.value)}"]`)?.focus();
}

const ALIGNMENT = { start: "justify-start", center: "justify-center", end: "justify-end" } as const;
</script>

<template>
  <div>
    <!-- Scope capsules (compact screens) -->
    <nav v-if="capsules" ref="list" class="-mx-1 overflow-x-auto overflow-y-hidden" :aria-label="props.label">
      <ul class="flex gap-2 p-1" role="tablist" :aria-label="props.label">
        <li v-for="(tab, index) in props.tabs" :key="tab.value" role="presentation" class="shrink-0">
          <button :id="tabId(tab)" type="button" role="tab" :aria-selected="isActive(tab)" :tabindex="isActive(tab) ? 0 : -1"
            :aria-controls="`${id}-panel`" :data-tab="String(tab.value)"
            class="flex min-h-[2.125rem] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-subheadline font-semibold transition-colors duration-motion-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            :class="isActive(tab) ? 'bg-tint text-content-on-tint' : 'bg-surface-cell text-content-strong shadow-group active:bg-fill'"
            @click="select(tab)" @keydown="onKeydown($event, index)">
            {{ tab.shortLabel ?? tab.label }}
            <span v-if="tab.badge" class="text-footnote font-normal tabular-nums">{{ tab.badge }}</span>
            <Icon v-if="tab.warning" name="alertTriangle" :size="14" :label="tab.warning" />
          </button>
        </li>
      </ul>
    </nav>

    <!-- Segmented control. A scope bar wraps instead of scrolling: its last segments were cut
         off at the card edge with no scroll hint. -->
    <nav v-else ref="list" :aria-label="props.label" :class="[
      props.presentation === 'scope' ? '' : 'overflow-y-hidden overflow-x-auto whitespace-nowrap',
      props.presentation === 'plain' ? '' : 'rounded-control bg-fill p-0.5',
    ]">
      <ul :class="['flex gap-0.5', props.presentation === 'scope' ? 'flex-wrap whitespace-nowrap' : '', ALIGNMENT[props.alignment]]"
        role="tablist" :aria-label="props.label">
        <li v-for="(tab, index) in props.tabs" :key="tab.value" role="presentation" :class="{ 'flex flex-1': props.stretch }">
          <button :id="tabId(tab)" type="button" role="tab" :aria-selected="isActive(tab)" :tabindex="isActive(tab) ? 0 : -1"
            :aria-controls="`${id}-panel`" :data-tab="String(tab.value)" :class="[
              'flex min-h-8 cursor-pointer items-center justify-center rounded-control px-3.5 py-1 text-subheadline transition-colors duration-motion-fast ease-motion-standard focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus',
              isActive(tab)
                ? 'bg-segment-selected font-semibold text-content-strong shadow-sm'
                : 'font-medium text-content hover:text-content-strong',
              props.stretch ? 'flex-1' : '',
            ]" @click="select(tab)" @keydown="onKeydown($event, index)">
            <Icon v-if="tab.icon" :name="tab.icon" class="mr-2" :class="isActive(tab) ? 'text-content-link' : ''" />
            {{ tab.label }}
            <span v-if="tab.badge"
              :class="['ml-2 block min-w-[1.125rem] rounded-full px-1.5 text-center text-caption font-semibold tabular-nums', isActive(tab) ? 'bg-tint-soft text-content-link' : 'bg-surface-cell text-content-muted']">
              {{ tab.badge }}
            </span>
            <Icon v-if="tab.warning" name="alertTriangle" :size="16" :label="tab.warning" class="ml-2 text-status-warning-content" />
          </button>
        </li>
      </ul>
    </nav>

    <div v-if="$slots.default" :id="`${id}-panel`" role="tabpanel" :aria-labelledby="active ? tabId(active) : undefined" class="mt-4">
      <slot />
    </div>
  </div>
</template>
