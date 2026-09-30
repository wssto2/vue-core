<script setup lang="ts" generic="Row">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useFormat } from "../format";
import { Icon } from "../icon";
import type { Collection } from "./useCollection";

/**
 * Paging stays explicit (no endless scrolling). Desktop: the range ("1 to 25 of 248"), the page
 * size and page capsules with the first and last page always present. Phones and tablets: one
 * thumb-sized "‹ Page 2 of 9 ›", nothing at all when everything fits on one page.
 */
const props = defineProps<{
  collection: Collection<Row>;
  compact: boolean;
  /** Phone rows sit on the canvas: the pager has no card border. */
  flat: boolean;
}>();

const emit = defineEmits<{ turned: [] }>();

const { t } = useI18n();
const format = useFormat();

const current = computed(() => props.collection.query.value.page);
const last = computed(() => props.collection.page.value?.lastPage ?? 0);
const info = computed(() => props.collection.page.value);

/** The page numbers around the current one: always the first and last, two either side of it, null where a run is elided. */
const numbers = computed<(number | null)[]>(() => {
  if (last.value <= 1) return last.value === 1 ? [1] : [];
  const pages: (number | null)[] = [1];
  const from = Math.max(2, current.value - 2);
  const to = Math.min(last.value - 1, current.value + 2);
  if (from > 2) pages.push(null);
  for (let page = from; page <= to; page++) pages.push(page);
  if (to < last.value - 1) pages.push(null);
  pages.push(last.value);
  return pages;
});

function turn(direction: -1 | 1) {
  if (direction === 1) props.collection.nextPage();
  else props.collection.previousPage();
  emit("turned");
}

const capsule = (active: boolean) =>
  [
    "hit-target inline-flex h-7 min-w-7 cursor-pointer items-center justify-center rounded-button px-2 transition-colors duration-motion-fast disabled:cursor-not-allowed disabled:opacity-40",
    active ? "bg-tint font-semibold text-content-on-tint" : "text-content-strong hover:bg-fill disabled:hover:bg-transparent",
  ].join(" ");

function onSize(event: Event) {
  props.collection.setPageSize(Number((event.target as HTMLSelectElement).value));
}
</script>

<template>
  <!-- Phones and tablets: one compact, thumb-sized pager; nothing when everything fits on one page. -->
  <nav v-if="props.compact && last > 1" :aria-label="t('core.collection.page.label')" class="flex select-none items-center justify-between gap-3 px-1 py-2"
    :class="props.flat ? 'mt-1' : 'border-t border-border-separator'" data-test="collection-pager-compact">
    <button type="button" class="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-content-link active:bg-fill disabled:cursor-not-allowed disabled:text-content-disabled"
      :disabled="current <= 1" @click="turn(-1)">
      <Icon name="arrowLeftSLine" :size="20" />
      <span class="sr-only">{{ t("core.collection.page.previous") }}</span>
    </button>
    <span class="text-subheadline tabular-nums text-content-muted" aria-live="polite">
      {{ t("core.collection.page.page_of", { current: format.number(current), total: format.number(last) }) }}
    </span>
    <button type="button" class="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-content-link active:bg-fill disabled:cursor-not-allowed disabled:text-content-disabled"
      :disabled="current >= last" @click="turn(1)">
      <Icon name="arrowRightSLine" :size="20" />
      <span class="sr-only">{{ t("core.collection.page.next") }}</span>
    </button>
  </nav>

  <div v-else-if="!props.compact" class="flex select-none flex-col items-center justify-between gap-3 border-t border-border-separator px-4 py-2.5 md:flex-row">
    <div class="flex flex-col items-center gap-x-4 text-footnote tabular-nums text-content-muted md:flex-row">
      <span v-if="info" aria-live="polite">{{ t("core.collection.page.total", { from: format.number(info.from), to: format.number(info.to), total: format.number(info.total) }) }}</span>
      <label class="flex items-center">
        <span class="mr-2">{{ t("core.collection.page.per_page") }}:</span>
        <select :value="props.collection.query.value.pageSize" class="cursor-pointer rounded-control bg-transparent py-0.5 pr-1 font-semibold text-content-strong hover:bg-fill" @change="onSize">
          <option v-for="size in props.collection.pageSizes" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>
    </div>
    <nav :aria-label="t('core.collection.page.label')" class="flex items-center gap-0.5 text-subheadline tabular-nums">
      <button type="button" :class="capsule(false)" :disabled="current <= 1" @click="turn(-1)">
        <Icon name="arrowLeftSLine" :size="16" />
        <span class="sr-only">{{ t("core.collection.page.previous") }}</span>
      </button>
      <template v-for="(entry, index) in numbers" :key="index">
        <span v-if="entry === null" class="px-1.5 text-content-disabled">…</span>
        <button v-else type="button" :class="capsule(entry === current)" :aria-current="entry === current ? 'page' : undefined" @click="props.collection.goToPage(entry)">
          {{ format.number(entry) }}
        </button>
      </template>
      <button type="button" :class="capsule(false)" :disabled="current >= last" @click="turn(1)">
        <Icon name="arrowRightSLine" :size="16" />
        <span class="sr-only">{{ t("core.collection.page.next") }}</span>
      </button>
    </nav>
  </div>
</template>
