<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { RouterLink } from "vue-router";
import { Icon } from "../icon";
import type { RecordNeighbors } from "./listContext";

/** "˄ 12 / 248 ˅": the previous and next record of the list the page was opened from. */
const props = defineProps<{ neighbors: RecordNeighbors }>();
const { t } = useI18n();
const button = "flex size-7 items-center justify-center rounded-full text-content-strong transition-colors duration-motion-fast hover:bg-fill-strong focus-visible:outline-2 focus-visible:outline-border-focus";
</script>

<template>
  <nav :aria-label="t('core.resource.pager.records')" data-test="record-pager" class="flex items-center gap-0.5 rounded-full bg-fill p-0.5">
    <RouterLink v-if="props.neighbors.previous" :to="props.neighbors.previous" :aria-label="t('core.resource.pager.previous')" data-test="pager-previous" :class="button">
      <Icon name="arrowDownSLine" :size="18" class="rotate-180" />
    </RouterLink>
    <span v-else :class="[button, 'pointer-events-none opacity-40']" aria-hidden="true"><Icon name="arrowDownSLine" :size="18" class="rotate-180" /></span>
    <span class="px-1.5 text-subheadline tabular-nums text-content-muted">{{ props.neighbors.position }} / {{ props.neighbors.total }}</span>
    <RouterLink v-if="props.neighbors.next" :to="props.neighbors.next" :aria-label="t('core.resource.pager.next')" data-test="pager-next" :class="button">
      <Icon name="arrowDownSLine" :size="18" />
    </RouterLink>
    <span v-else :class="[button, 'pointer-events-none opacity-40']" aria-hidden="true"><Icon name="arrowDownSLine" :size="18" /></span>
  </nav>
</template>
