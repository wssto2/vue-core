<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { RouterLink } from "vue-router";
import { Icon } from "../icon";
import PageActions from "./PageActions.vue";
import type { PageAction, PageBack, PagePathItem } from "./types";

/**
 * The desktop toolbar of a record page: "‹ Customers" back to the list with its state, the record
 * pager, a quiet status ("Unsaved changes") and the page actions, sticky under a translucent bar.
 * Presentational: `AdaptivePageShell` feeds it the registered page chrome; phones show the same
 * chrome in the nav bar instead.
 *
 * A page two or more levels deep in a hierarchy passes `path`: the toolbar then shows every
 * ancestor as a link ("‹ Catalogue › Passenger cars › Renault › Clio"), so any level is one click
 * away (Finder's path bar, Xcode's jump bar). The last item is the back. Phones keep the back alone.
 */
const props = defineProps<{
  back?: PageBack | null;
  path?: readonly PagePathItem[] | null;
  actions: readonly PageAction[];
  leading?: PageAction | null;
  status?: string | null;
}>();

defineSlots<{ pager?: () => unknown }>();

const { t } = useI18n();
const ancestors = computed(() => (props.path && props.path.length >= 2 ? props.path.slice(0, -1) : []));
const parent = computed(() => (props.path && ancestors.value.length ? props.path[props.path.length - 1] ?? null : props.back ?? null));
</script>

<template>
  <div class="sticky top-[var(--shell-banner-h,0px)] z-20 flex min-h-bar-height min-w-0 flex-wrap items-center gap-2.5 border-b border-border-separator bg-surface-page/85 py-2 pr-6 pl-4 backdrop-blur-xl">
    <nav v-if="ancestors.length && parent" :aria-label="t('core.page.breadcrumbs')" class="-ml-1 flex min-w-0 items-center">
      <span class="flex shrink-0 text-content-link" aria-hidden="true"><Icon name="arrowLeftSLine" :size="20" /></span>
      <ol class="flex min-w-0 items-center">
        <!-- Below lg (a tablet) the ancestors give way to the back link: the path and the actions
             wrapped the toolbar onto two rows at 768 px. -->
        <li v-for="item in ancestors" :key="item.label" class="flex min-w-0 max-w-48 shrink items-center max-lg:hidden">
          <RouterLink :to="item.to" data-page-path-item
            class="min-w-0 truncate rounded-control px-1 py-1 text-subheadline text-content-muted hover:bg-tint-soft hover:text-content-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus">
            {{ item.label }}
          </RouterLink>
          <span class="flex shrink-0 text-content-disabled" aria-hidden="true"><Icon name="arrowRightSLine" :size="14" /></span>
        </li>
        <li class="flex min-w-0 shrink-0 items-center">
          <RouterLink :to="parent.to" data-page-back
            class="min-w-0 truncate rounded-control px-1 py-1 text-subheadline font-medium text-content-link hover:bg-tint-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus">
            {{ parent.label }}
          </RouterLink>
        </li>
      </ol>
    </nav>
    <RouterLink v-else-if="props.back" :to="props.back.to" data-page-back
      class="-ml-1 flex min-w-0 items-center gap-0.5 rounded-control py-1 pr-2 pl-0.5 text-subheadline font-medium text-content-link hover:bg-tint-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus">
      <Icon name="arrowLeftSLine" :size="20" />
      <span class="truncate">{{ props.back.label }}</span>
    </RouterLink>
    <div class="min-w-0 flex-1"></div>
    <slot name="pager" />
    <span v-if="props.status" class="flex shrink-0 items-center gap-1.5 text-footnote text-content-muted" role="status" data-page-status>
      <span class="size-1.75 rounded-full bg-tint" aria-hidden="true"></span>{{ props.status }}
    </span>
    <PageActions :actions="props.actions" :leading="props.leading" />
  </div>
</template>
