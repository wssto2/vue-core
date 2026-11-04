
<script setup lang="ts">
import type { RequirementItem } from "./requirementItem";
import { Icon } from "../icon";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

/**
 * RequirementList — the preconditions of a phase transition as one grouped
 * list (Emerald Native, plan phase F; prototype `requirementGroup`). One row per
 * precondition, read top to bottom: an unmet row has a red cross, its hint and
 * a "Fill in" link to the screen that fixes it (tinted capsule on desktop,
 * tinted text on compact screens); a met row has a filled check. When every
 * item is met it collapses to a single met row with the summary.
 */
const { t } = useI18n();

const props = defineProps<{
  items: RequirementItem[];
  /** Group header ("Nedostaju sljedeći podaci:"). */
  title?: string;
  /** Row text shown when every item is met. */
  summaryWhenMet?: string;
}>();

const allMet = computed(
  () => props.items.length > 0 && props.items.every((item) => item.met),
);
</script>

<template>
  <div v-if="allMet" data-test="requirements-all-met" role="status"
    class="flex min-h-row items-center gap-3 rounded-group bg-surface-cell px-row-inset py-2.5 shadow-group">
    <span aria-hidden="true" class="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-control-on text-white compact:size-7">
      <Icon name="checkCustom" :size="14" />
    </span>
    <p class="min-w-0 flex-1 text-body font-medium text-content-strong">
      {{ props.summaryWhenMet ?? t("core.requirements.all_met") }}
    </p>
  </div>

  <section v-else data-test="requirement-list" class="flex min-w-0 flex-col">
    <h3 v-if="props.title"
      class="px-row-inset pb-2 text-subheadline font-semibold text-content-strong compact:text-footnote compact:font-normal compact:uppercase compact:tracking-wide compact:text-content-muted">
      {{ props.title }}
    </h3>

    <ul class="rounded-group bg-surface-cell shadow-group">
      <li v-for="item in props.items" :key="item.key" class="group/req flex items-center gap-3 pl-row-inset"
        :data-test="`requirement-${item.key}`" :data-met="item.met">
        <span aria-hidden="true" class="flex size-[22px] shrink-0 items-center justify-center rounded-full compact:size-7"
          :class="item.met ? 'bg-control-on text-white' : 'bg-status-danger-surface text-status-danger-content'">
          <Icon :name="item.met ? 'checkCustom' : 'close'" :size="12" />
        </span>

        <div class="flex min-h-row min-w-0 flex-1 items-center gap-3 border-t border-border-separator py-2 pr-row-inset group-first/req:border-t-0">
          <div class="min-w-0 flex-1">
            <p class="text-body text-content-strong">
              {{ item.label }}
              <span class="sr-only">({{ item.met ? t("core.requirements.met") : t("core.requirements.not_met") }})</span>
            </p>
            <p v-if="item.hint" class="mt-0.5 text-footnote text-content-muted">
              {{ item.hint }}
            </p>
          </div>

          <router-link v-if="!item.met && item.fix" :to="item.fix.to"
            class="hit-target relative inline-flex min-h-7 shrink-0 items-center rounded-full bg-tint-soft px-3 text-footnote font-semibold text-content-link transition-[filter] duration-motion-fast hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus dark:hover:brightness-125 compact:bg-transparent compact:px-1 compact:text-headline">
            {{ item.fix.label }}
          </router-link>
        </div>
      </li>
    </ul>
  </section>
</template>
