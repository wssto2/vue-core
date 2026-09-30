<script setup lang="ts">
import { computed, useId, useSlots } from "vue";
import { Icon } from "../icon";
import type { PanelProps } from "./panel";

/**
 * A titled region of a record page. `card` is a surface with a title bar, a body and an optional
 * footer; `section` is a section of a long editor: no card, the number in the tint and a
 * title-size heading on the canvas, the content as grouped rows below.
 *
 *   <Panel :title="t('contact')" icon="userLine">
 *     <template #actions><Button size="sm">Edit</Button></template>
 *     …content…
 *     <template #footer><Button>Save</Button></template>
 *   </Panel>
 *
 * `collapsible` makes the title a disclosure button (`v-model:collapsed` controls it, or it keeps
 * its own state); the body stays in the DOM while collapsed so form state survives. Extra
 * attributes (an `id` for a jump link) land on the root.
 */
const props = withDefaults(defineProps<PanelProps>(), {
  title: undefined,
  icon: undefined,
  number: undefined,
  subtitle: undefined,
  presentation: "card",
  collapsible: false,
  flush: false,
  headingLevel: 2,
});

const collapsed = defineModel<boolean>("collapsed", { default: false });

defineSlots<{
  /** Controls in the title bar, after the title. */
  actions?: () => unknown;
  footer?: () => unknown;
  default?: () => unknown;
}>();

const slots = useSlots();
const bodyId = `panel-body-${useId()}`;

function toggle() {
  if (props.collapsible) collapsed.value = !collapsed.value;
}
function expand() {
  if (props.collapsible) collapsed.value = false;
}
function collapse() {
  if (props.collapsible) collapsed.value = true;
}

const isSection = computed(() => props.presentation === "section");
const hasTitle = computed(() => Boolean(props.title));
const heading = computed(() => `h${props.headingLevel}`);

defineExpose({ toggle, expand, collapse });
</script>

<template>
  <div :data-presentation="props.presentation"
    :class="isSection ? 'flex min-w-0 flex-col gap-4' : 'rounded-group bg-surface-cell shadow-group'">
    <!-- Section: the number in the tint, a title-size heading, the toggle at the end. -->
    <div v-if="isSection && hasTitle" class="flex min-w-0 items-center gap-3 px-0.5">
      <component :is="heading" class="min-w-0 flex-1">
        <component :is="props.collapsible ? 'button' : 'span'" :type="props.collapsible ? 'button' : undefined"
          class="flex w-full min-w-0 items-baseline gap-2.5 text-left"
          :class="props.collapsible ? 'cursor-pointer rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus' : ''"
          :aria-expanded="props.collapsible ? !collapsed : undefined" :aria-controls="props.collapsible ? bodyId : undefined"
          @click="toggle()">
          <span v-if="props.number" class="shrink-0 select-none text-footnote font-semibold tabular-nums text-content-link">{{ props.number }}</span>
          <span class="min-w-0 text-title font-semibold tracking-tight text-content-strong">{{ props.title }}</span>
          <span v-if="props.subtitle" class="hidden min-w-0 truncate text-subheadline text-content-muted sm:inline">{{ props.subtitle }}</span>
        </component>
      </component>
      <slot name="actions" />
      <Icon v-if="props.collapsible" name="arrowDownSLine" :size="20"
        class="cursor-pointer text-content-muted transition-transform duration-motion-fast" :class="!collapsed ? 'rotate-180' : ''"
        @click="toggle()" />
    </div>

    <!-- Card: a title bar over a hairline. -->
    <div v-else-if="hasTitle" class="flex items-center border-b border-border-separator pl-4"
      :class="slots.actions ? 'py-2 pr-2' : 'py-3 pr-4'">
      <component :is="heading" class="min-w-0 flex-1 text-sm font-semibold tracking-wide">
        <component :is="props.collapsible ? 'button' : 'span'" :type="props.collapsible ? 'button' : undefined"
          class="flex w-full items-center gap-2 text-left"
          :class="props.collapsible ? 'cursor-pointer appearance-none bg-transparent p-0 text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus' : ''"
          :aria-expanded="props.collapsible ? !collapsed : undefined" :aria-controls="props.collapsible ? bodyId : undefined"
          @click="toggle()">
          <span v-if="props.number" class="select-none font-mono text-xs font-normal tabular-nums text-content-muted">{{ props.number }}</span>
          <Icon v-if="props.icon" :name="props.icon" class="inline-block text-content-muted" />
          {{ props.title }}
          <span v-if="props.subtitle" class="hidden text-xs font-normal text-content-muted sm:inline">· {{ props.subtitle }}</span>
        </component>
      </component>
      <slot name="actions" />
      <span v-if="props.collapsible" aria-hidden="true" class="cursor-pointer" @click="toggle()">
        <Icon name="arrowDownSLine" :class="!collapsed ? 'rotate-180' : ''" />
      </span>
    </div>

    <div :id="bodyId" v-show="!collapsed" :class="{ 'p-4': !props.flush && !isSection }">
      <slot />
    </div>

    <div v-if="slots.footer && !collapsed" class="mt-4 flex justify-end rounded-b-group border-t border-border-separator bg-surface-page p-4">
      <slot name="footer" />
    </div>
  </div>
</template>
