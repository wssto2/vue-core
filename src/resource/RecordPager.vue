<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { RouterLink, useRouter } from "vue-router";
import { useKeyboardShortcut } from "../button";
import { Icon } from "../icon";
import { Tooltip } from "../overlay";
import type { RecordNeighbors } from "./listContext";

/**
 * "˄ 12 / 286 ˅" for a record page opened from a list: the previous and next record of the list the user came from. The
 * arrows and K / J do the same from the keyboard (off while typing in a field, and for a key held down). `ResourcePage` shows
 * it for its `list`; a page with a layout of its own puts it in `AdaptivePageShell`'s `#pager` slot:
 *
 *   <template #pager><RecordPager v-if="neighbors.context.neighbors" :neighbors="neighbors.context.neighbors" /></template>
 */
const props = defineProps<{ neighbors: RecordNeighbors }>();

const { t } = useI18n();
const router = useRouter();

// j / k as in mail clients and GitHub; the arrows for everyone else. They act only while there is somewhere to go.
const step = (key: string, direction: "next" | "previous") =>
  useKeyboardShortcut({ key, group: "record", label: () => t(`core.resource.pager.${direction}`) }, () => {
    const target = props.neighbors[direction];
    if (!target) return false;
    void router.push(target);
  });
step("j", "next");
step("ArrowRight", "next");
step("k", "previous");
step("ArrowLeft", "previous");

const button =
  "hit-target flex size-6 items-center justify-center rounded-button text-content-strong transition-colors duration-motion-fast hover:bg-fill-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus compact:size-9 compact:text-content-link compact:hover:bg-transparent";
const disabled = "pointer-events-none opacity-40";
</script>

<template>
  <nav :aria-label="t('core.resource.pager.records')" data-test="record-pager"
    class="inline-flex shrink-0 items-center rounded-button bg-fill p-0.5 compact:gap-0.5 compact:bg-surface-overlay compact:p-1 compact:shadow-float">
    <Tooltip v-if="props.neighbors.previous" side="bottom" :delay="300" :text="`${t('core.resource.pager.previous')} (← / K)`">
      <RouterLink :to="props.neighbors.previous" :aria-label="t('core.resource.pager.previous')" aria-keyshortcuts="ArrowLeft K" data-test="pager-previous" :class="button">
        <Icon name="arrowUpSLine" :size="18" />
      </RouterLink>
    </Tooltip>
    <span v-else :class="[button, disabled]" aria-hidden="true"><Icon name="arrowUpSLine" :size="18" /></span>

    <span class="min-w-14 px-1 text-center text-footnote tabular-nums text-content-muted compact:px-1.5" data-test="pager-position" aria-live="polite">
      {{ props.neighbors.position }} / {{ props.neighbors.total }}
    </span>

    <Tooltip v-if="props.neighbors.next" side="bottom" :delay="300" :text="`${t('core.resource.pager.next')} (→ / J)`">
      <RouterLink :to="props.neighbors.next" :aria-label="t('core.resource.pager.next')" aria-keyshortcuts="ArrowRight J" data-test="pager-next" :class="button">
        <Icon name="arrowDownSLine" :size="18" />
      </RouterLink>
    </Tooltip>
    <span v-else :class="[button, disabled]" aria-hidden="true"><Icon name="arrowDownSLine" :size="18" /></span>
  </nav>
</template>
