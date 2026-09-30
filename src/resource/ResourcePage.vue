<script setup lang="ts" generic="T, Id extends ResourceId = number">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import AdaptivePageShell from "../page/AdaptivePageShell.vue";
import type { PageAction, PageBack } from "../page/types";
import AsyncSection from "../state/AsyncSection.vue";
import EmptyState from "../state/EmptyState.vue";
import type { RecordListContext } from "./listContext";
import RecordPager from "./RecordPager.vue";
import type { Resource, ResourceId } from "./resource";

/**
 * A record page: the page shell around a resource, with the loading, failed and not-found states
 * written once. It receives the resource, not a URL, and loads nothing itself.
 *
 *   <ResourcePage :resource="ticket" :title="title" :back="{ label: t('tickets'), to: ticketRoutes.index }">
 *     <template #header="{ record }"><RecordHeader :title="record.subject" /></template>
 *     <template #default="{ record }">
 *       <SectionNavigator :label="t('sections')" desktop="sidebar" compact="rows">
 *         <template #summary><TicketSummary :ticket="record" /></template>
 *         <AppRouterView />
 *       </SectionNavigator>
 *     </template>
 *   </ResourcePage>
 *
 * - `header` and `default` render only with a loaded record, and receive it non-null (also while it is
 *   being read again or a re-read failed: the record stays on screen, with a quiet refreshing or
 *   retry line). Before that the header is the plain title, and `loading` (a skeleton by default) stands
 *   where the content will be; a failed read shows the error with a retry, a missing record (404, or an
 *   invalid address) a not-found state.
 * - `title` is the large title until a `header` takes over, the phone bar's title and the browser tab's:
 *   pass the record's name once loaded, a fixed word before.
 * - A record opened from a list passes `list` (back with the list's state, the pager); a direct link
 *   passes `back`. `#pager` replaces the pager.
 *
 * A region of the record that loads on its own takes the record's resource (`useResource({ for: record, load })`): it waits until
 * the record is loaded, so a missing record is one not-found state, never one per region.
 *
 * A record page with a layout of its own (a lead's columns, independent panels) composes
 * `AdaptivePageShell`, the header and `SectionNavigator` itself on the same resource.
 */
const props = withDefaults(defineProps<{
  resource: Resource<T, Id>;
  title: string;
  /** Where "back" leads when the page was not opened from a list. */
  back?: PageBack | null;
  list?: RecordListContext | null;
  actions?: readonly PageAction[];
  width?: "full" | "content" | "readable";
}>(), { back: undefined, list: null, actions: () => [], width: "content" });

defineSlots<{
  /** The record's header; receives the loaded record. */
  header?: (scope: { record: T }) => unknown;
  /** The page's content; receives the loaded record. */
  default?: (scope: { record: T }) => unknown;
  /** Stands where the content will be while the record is read. */
  loading?: () => unknown;
  /** Replaces the pager of `list`. */
  pager?: () => unknown;
}>();

const { t } = useI18n();
const state = computed(() => props.resource.state.value);
const record = computed(() => props.resource.data.value);
const missing = computed(() => state.value.status === "failed" && "reason" in state.value && state.value.reason === "notFound");
const back = computed(() => props.back ?? props.list?.back ?? null);
</script>

<template>
  <AdaptivePageShell :title="props.title" :document-title="props.title" :back="back" :actions="props.actions" :width="props.width">
    <template v-if="$slots.pager || props.list?.neighbors" #pager>
      <slot name="pager"><RecordPager v-if="props.list?.neighbors" :neighbors="props.list.neighbors" /></slot>
    </template>

    <template v-if="record !== null && $slots.header" #header><slot name="header" :record="record" /></template>

    <EmptyState v-if="missing" :title="t('core.resource.not_found.title')" :description="t('core.resource.not_found.body')" icon="errorWarningLine" />
    <AsyncSection v-else :state="state" :is-empty="() => false" @retry="props.resource.reload()">
      <template #default="{ value }"><slot :record="value" /></template>
      <template v-if="$slots.loading" #skeleton><slot name="loading" /></template>
    </AsyncSection>
  </AdaptivePageShell>
</template>
