<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useKeyboardShortcut } from "../button";
import { Icon } from "../icon";
import { Tooltip } from "../overlay";
import type { CollectionNeighbors, Neighbor } from "./neighbors";

/**
 * "‹ 12 / 286 ›" for a record page opened from a list: steps to the previous or next record of the
 * list the user came from, with its filters and sort; ← / → or K / J do the same from the keyboard
 * (off while typing in a field or with a dialog open). Renders nothing when the page was not opened
 * from a list or the record is no longer in it. Put it in the page shell's `#pager` slot.
 *
 *   const neighbors = useCollectionNeighbors(tickets, { current: () => ticketID.value, list: ticketRoutes.index, param: "ticketID" });
 *   <template #pager><NeighborPager :neighbors="neighbors" /></template>
 */
const props = defineProps<{ neighbors: CollectionNeighbors }>();

const { t } = useI18n();
const router = useRouter();

function go(neighbor: Neighbor | null) {
  if (neighbor) void router.push(neighbor.to);
}

// j / k as in mail clients and GitHub; the arrows for everyone else. They act only while there is somewhere to go.
const step = (key: string, direction: "next" | "previous") =>
  useKeyboardShortcut({ key }, () => {
    const target = props.neighbors[direction].value;
    if (!target) return false;
    go(target);
  });
step("j", "next");
step("ArrowRight", "next");
step("k", "previous");
step("ArrowLeft", "previous");

const button =
  "hit-target flex size-6 cursor-pointer items-center justify-center rounded-button text-content-strong transition-colors duration-motion-fast hover:bg-fill-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent compact:size-9 compact:text-content-link compact:hover:bg-transparent";
</script>

<template>
  <nav v-if="props.neighbors.position.value !== null"
    class="inline-flex shrink-0 items-center rounded-button bg-fill p-0.5 compact:gap-0.5 compact:bg-surface-overlay compact:p-1 compact:shadow-float"
    :aria-label="t('core.collection.record_pager.label')" data-test="collection-pager">
    <Tooltip side="bottom" :delay="300" :text="`${t('core.collection.record_pager.previous')} (← / K)`">
      <button type="button" :class="button" :disabled="!props.neighbors.previous.value" :aria-label="t('core.collection.record_pager.previous')"
        aria-keyshortcuts="ArrowLeft K" data-test="collection-pager-previous" @click="go(props.neighbors.previous.value)">
        <Icon name="arrowUpSLine" :size="18" />
      </button>
    </Tooltip>

    <span class="min-w-14 px-1 text-center text-footnote tabular-nums text-content-muted compact:px-1.5" data-test="collection-pager-position" aria-live="polite">
      {{ props.neighbors.position.value }} / {{ props.neighbors.total.value }}
    </span>

    <Tooltip side="bottom" :delay="300" :text="`${t('core.collection.record_pager.next')} (→ / J)`">
      <button type="button" :class="button" :disabled="!props.neighbors.next.value" :aria-label="t('core.collection.record_pager.next')"
        aria-keyshortcuts="ArrowRight J" data-test="collection-pager-next" @click="go(props.neighbors.next.value)">
        <Icon name="arrowDownSLine" :size="18" />
      </button>
    </Tooltip>
  </nav>
</template>
