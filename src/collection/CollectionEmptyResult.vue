<script setup lang="ts">
import { useI18n } from "vue-i18n";
import Button from "../button/Button.vue";
import { Icon } from "../icon";
import type { FilterChip } from "./filters";

/**
 * The empty state of a filtered list: instead of a bare "no data" it shows which filters produced
 * nothing and the two ways out: remove the filter the user touched last, or clear everything. Each
 * listed filter is removable too.
 */
const props = defineProps<{
  chips: readonly FilterChip[];
  /** The chip "remove last" removes. */
  lastChip: FilterChip | null;
}>();

const emit = defineEmits<{ remove: [chip: FilterChip]; clearAll: [] }>();

const { t } = useI18n();
</script>

<template>
  <div class="mx-auto max-w-xl py-8 text-center" data-test="collection-empty-filtered">
    <Icon name="filter3" :size="32" class="mx-auto text-content-disabled" />
    <h3 class="mt-3 mb-1 text-headline font-semibold text-content-strong">{{ t("core.collection.empty.title") }}</h3>
    <p class="text-sm text-content-muted">{{ t("core.collection.empty.description") }}</p>

    <ul class="mt-4 flex flex-wrap justify-center gap-2">
      <li v-for="chip in props.chips" :key="chip.key"
        class="inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-control bg-surface-cell pr-0.5 pl-2.5 text-sm shadow-group ring-1 ring-inset ring-border-separator">
        <span v-if="chip.label" class="shrink-0 text-content-muted">{{ chip.label }}</span>
        <!-- A long search term is cut, not a chip wider than the page. -->
        <span class="min-w-0 truncate font-medium text-content-strong" :title="chip.values.join(' › ')">{{ chip.values.join(" › ") }}</span>
        <button type="button" class="shrink-0 cursor-pointer rounded p-1 text-content-disabled hover:bg-fill hover:text-content-strong"
          :aria-label="`${t('core.collection.clear')}: ${chip.label ?? chip.values.join(' › ')}`" @click="emit('remove', chip)">
          <Icon name="close" :size="12" />
        </button>
      </li>
    </ul>

    <div class="mt-5 flex flex-wrap justify-center gap-2">
      <Button v-if="props.lastChip" v-bind="{ 'data-test': 'collection-empty-remove-last' }" prominence="secondary" size="sm" @click="emit('remove', props.lastChip)">
        {{ t("core.collection.empty.remove_last", { filter: props.lastChip.values.join(" › ") }) }}
      </Button>
      <Button v-bind="{ 'data-test': 'collection-empty-clear-all' }" size="sm" @click="emit('clearAll')">{{ t("core.collection.empty.clear_all") }}</Button>
    </div>
  </div>
</template>
