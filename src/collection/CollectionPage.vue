<script setup lang="ts" generic="Row extends object, Col extends Column<Row>">
import { computed, useSlots } from "vue";
import { AdaptivePageShell, type PageAction } from "../page";
import type { IconName } from "../icon";
import CollectionTable from "./CollectionTable.vue";
import type { Column, RowAction } from "./columns";
import type { CollectionSlots } from "./slots";
import type { Collection } from "./useCollection";

/**
 * A list page: the page shell (title, count, actions, phone nav bar) around a `CollectionTable`.
 * The page supplies the collection, the title and its actions; the cells it cannot leave to the
 * standard kinds come through typed `#cell-<key>` slots.
 *
 *   <CollectionPage :collection="tickets" :title="t('tickets.title')" :actions="actions">
 *     <template #cell-status="{ item }"><TicketStatus :status="item.status" /></template>
 *   </CollectionPage>
 *
 * It adds nothing the table and the shell do not do: a page that needs another layout composes
 * `AdaptivePageShell` and `CollectionTable` itself with the same collection.
 */
const props = withDefaults(defineProps<{
  collection: Collection<Row, string, string, string, Col>;
  title: string;
  description?: string;
  icon?: IconName;
  /** The page actions the user may use (a create button); the shell decides where they render. */
  actions?: readonly PageAction[];
  /** Same as on `CollectionTable`. */
  rowActions?: (row: Row) => RowAction[];
  rowLabel?: (row: Row) => string;
  rowHeight?: number;
  density?: "regular" | "condensed";
  viewsPresentation?: "segmented" | "scope";
  actionsVisible?: boolean;
}>(), {
  description: undefined,
  icon: undefined,
  actions: () => [],
  rowActions: undefined,
  rowLabel: undefined,
  rowHeight: undefined,
  density: "regular",
  viewsPresentation: "segmented",
  actionsVisible: false,
});

defineSlots<CollectionSlots<Row, Col> & {
  /** Content after the table: the page's own dialogs and sheets. */
  default?: () => unknown;
}>();

// Every slot the page was given goes to the table as it is, so the typed scopes stay the table's.
const forwarded = computed(() => Object.keys(useSlots()).filter((name) => name !== "default"));
const count = computed(() => props.collection.total.value || null);
</script>

<template>
  <AdaptivePageShell :title="props.title" :description="props.description" :icon="props.icon" :count="count" :actions="props.actions">
    <CollectionTable :collection="props.collection" :row-actions="props.rowActions" :row-label="props.rowLabel" :row-height="props.rowHeight" :density="props.density"
      :views-presentation="props.viewsPresentation" :actions-visible="props.actionsVisible">
      <template v-for="name in forwarded" :key="name" #[name]="scope">
        <!-- @vue-ignore -->
        <slot :name="name" v-bind="(scope as Record<string, unknown> | undefined) ?? {}" />
      </template>
    </CollectionTable>
    <slot />
  </AdaptivePageShell>
</template>
