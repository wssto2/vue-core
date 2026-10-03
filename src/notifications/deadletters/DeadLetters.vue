<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { isApiError } from "../../client";
import { CollectionPage, useCollection, type CollectionColumns, type FilterDescriptor, type RowAction } from "../../collection";
import { useDescribeError } from "../../i18n";
import { useFormat } from "../../format";
import type { DeadLetterRow } from "../../modules/events/entities";
import { eventsRoutes } from "../../modules/events/routes";
import { AlertDialog, toast } from "../../overlay";
import { useLoad } from "../../state";
import { usePlatform } from "../../platform";
import { RETRY_DEAD_LETTERS } from "./access";
import { deadLetterList } from "./list";

/**
 * The events a consumer gave up on after its retries, of every consumer of the queue: what failed and why, narrowed to one
 * consumer by the filter (a choice among the application's consumers). "Retry" puts one back in the queue; "Retry all for this consumer" (after a question) puts back every
 * one of that consumer. Both are behind `events.deadletter:retry`; an event whose payload was already removed cannot be retried.
 */
const { t } = useI18n();
const { http, access } = usePlatform();
const format = useFormat();
const describeError = useDescribeError();
const confirm = useTemplateRef<{ present: (consumer: string) => void }>("confirm");

const columns = computed(() => [
  { key: "event_name", label: t("core.notifications.dead_letters.columns.event"), kind: "identity", title: (row: DeadLetterRow) => row.event_name || t("core.notifications.dead_letters.event_gone"), subtitle: (row: DeadLetterRow) => t("core.notifications.dead_letters.event_id", { id: row.event_id }), mobile: "primary" },
  { key: "consumer", label: t("core.notifications.dead_letters.columns.consumer"), hideBelow: "md", width: 220, mobile: "meta" },
  { key: "attempts", label: t("core.notifications.dead_letters.columns.attempts"), hideBelow: "md", width: 100, align: "center", mobile: "hidden" },
  { key: "last_error", label: t("core.notifications.dead_letters.columns.last_error"), hideBelow: "md", mobile: "hidden" },
  { key: "dead_at", label: t("core.notifications.dead_letters.columns.dead_at"), width: 170, mobile: "accessory" },
] satisfies CollectionColumns<DeadLetterRow>);

// The consumers the application has, for the filter; a text field until they are known (and when they cannot be read).
const consumers = useLoad(async ({ signal }) => (await http.request(eventsRoutes.consumers, undefined, { signal })).data.consumers);
const filters = computed<FilterDescriptor<"consumer">[]>(() => {
  const label = t("core.notifications.dead_letters.columns.consumer");
  const names = consumers.data.value;
  return [names ? { key: "consumer", label, type: "select", options: names.map((name) => ({ value: name, label: name })), defaultOptionTitle: t("core.notifications.dead_letters.all_consumers") } : { key: "consumer", label, type: "text" }];
});

const letters = useCollection(deadLetterList(http), { columns, filters, state: { kind: "url", key: "query" } });

const retrying = ref(false);
const askedFor = ref("");

function failure(error: unknown): string {
  if (isApiError(error) && error.kind === "notFound") return t("core.notifications.dead_letters.errors.not_found");
  if (isApiError(error) && error.kind === "conflict") return t("core.notifications.dead_letters.errors.event_gone");
  return describeError(error);
}

async function retry(row: DeadLetterRow) {
  if (retrying.value) return;
  retrying.value = true;
  try {
    await http.request(eventsRoutes.deadLettersRetry, { event: row.event_id, consumer: row.consumer });
    toast.success(t("core.notifications.dead_letters.toasts.retried"));
  } catch (error) {
    toast.error(failure(error));
  } finally {
    retrying.value = false;
    void letters.refresh();
  }
}

async function retryAll(consumer: string) {
  const { data } = await http.request(eventsRoutes.deadLettersRetryAll, { consumer });
  toast.success(t("core.notifications.dead_letters.toasts.retried_all", { count: data.retried }));
  void letters.refresh();
}

function rowActions(row: DeadLetterRow): RowAction[] {
  if (!row.retryable || !access.can(RETRY_DEAD_LETTERS)) return [];
  return [
    { key: "retry", label: t("core.notifications.dead_letters.actions.retry"), icon: "refreshLine", tone: "info", onSelect: () => void retry(row) },
    { key: "retry-all", label: t("core.notifications.dead_letters.actions.retry_all"), icon: "refreshLine", tone: "info", section: "all", onSelect: () => ((askedFor.value = row.consumer), confirm.value?.present(row.consumer)) },
  ];
}
</script>

<template>
  <CollectionPage :collection="letters" :title="t('core.notifications.dead_letters.title')" :description="t('core.notifications.dead_letters.description')" icon="errorWarningLine"
    :row-actions="rowActions" actions-visible :row-height="64" :row-label="(row) => row.event_name || t('core.notifications.dead_letters.event_gone')">
    <template #cell-last_error="{ item }">
      <span class="line-clamp-2 max-w-md text-footnote break-words whitespace-normal text-content" :title="item.last_error">{{ item.last_error }}</span>
    </template>
    <template #cell-dead_at="{ item, compact }">
      <time :datetime="item.dead_at" class="text-content" :class="compact ? 'text-footnote text-content-muted' : 'text-body'">{{ format.dateTime(item.dead_at) }}</time>
    </template>
    <AlertDialog ref="confirm" tone="warning" :title="t('core.notifications.dead_letters.retry_all.title')" :message="t('core.notifications.dead_letters.retry_all.message', { consumer: askedFor })"
      :confirm-label="t('core.notifications.dead_letters.retry_all.confirm')" :action="retryAll" @failed="(error) => toast.error(failure(error))" />
  </CollectionPage>
</template>
