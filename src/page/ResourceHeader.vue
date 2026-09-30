<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { Icon, type IconName } from "../icon";
import { useMediaQuery } from "../internal/mediaQuery";
import PageActions from "./PageActions.vue";
import { useLargeTitle } from "./useLargeTitle";
import type { PageAction } from "./types";

/**
 * The large title of a collection or settings page: a module tile, the title, a record count pill
 * and the page actions. Phones show the actions in the nav bar, so the header keeps only the title
 * there (and drops the description). A directly editable page without a toolbar also shows the
 * unsaved-changes status and the leading Cancel beside its actions, as the toolbar does.
 *
 *   <ResourceHeader :title="t('customers')" :count="total" icon="userLine" :actions="actions" />
 */
const props = withDefaults(defineProps<{
  title: string;
  description?: string;
  icon?: IconName;
  count?: number | null;
  actions?: readonly PageAction[];
  /** The leading action (Cancel while there are edits). */
  leading?: PageAction | null;
  /** A quiet status before the actions ("Unsaved changes"). */
  status?: string | null;
  /** Render the actions inline at every width (a specimen without a nav bar). */
  inlineActions?: boolean;
}>(), {
  description: undefined,
  icon: undefined,
  count: undefined,
  actions: () => [],
  leading: null,
  status: null,
  inlineActions: false,
});

defineSlots<{ leading?: () => unknown; description?: () => unknown }>();

const { locale } = useI18n();
// The nav bar exists below md, so that is where actions move.
const phone = useMediaQuery("(max-width: 47.999rem)");
const count = computed(() => (props.count == null ? null : new Intl.NumberFormat(locale.value).format(props.count)));

const titleElement = useTemplateRef<HTMLElement>("titleElement");
useLargeTitle(titleElement, () => props.title);
</script>

<template>
  <div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3">
    <div class="flex min-w-0 flex-[1_1_16rem] items-center gap-3.5">
      <slot name="leading">
        <span v-if="props.icon" aria-hidden="true"
          class="flex size-10 shrink-0 items-center justify-center rounded-group bg-tile-brand text-tile-brand-foreground compact:hidden">
          <Icon :name="props.icon" :size="20" />
        </span>
      </slot>
      <div class="flex min-w-0 flex-col gap-0.5">
        <div class="flex min-w-0 flex-wrap items-baseline gap-2.5">
          <h1 ref="titleElement" class="min-w-0 text-large-title font-semibold tracking-tight break-words text-content-strong">{{ props.title }}</h1>
          <span v-if="count !== null" data-resource-count
            class="rounded-full bg-fill px-2.5 py-0.5 text-subheadline font-semibold tabular-nums text-content-muted compact:bg-transparent compact:px-0 compact:font-normal">
            {{ count }}
          </span>
        </div>
        <p v-if="props.description" class="text-subheadline text-content-muted max-md:hidden">{{ props.description }}</p>
        <slot name="description" />
      </div>
    </div>
    <div v-if="props.inlineActions || !phone" class="ml-auto flex items-center gap-3">
      <span v-if="props.status" class="flex shrink-0 items-center gap-1.5 text-footnote text-content-muted" role="status" data-page-status>
        <span class="size-1.75 rounded-full bg-tint" aria-hidden="true"></span>{{ props.status }}
      </span>
      <PageActions :actions="props.actions" :leading="props.leading" />
    </div>
  </div>
</template>
