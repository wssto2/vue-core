<script setup lang="ts" generic="Value">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Button from "../button/Button.vue";
import { Icon, type IconName } from "../icon";
import { isEmptyValue, type AsyncState } from "./async";
import Banner from "./Banner.vue";
import EmptyState from "./EmptyState.vue";
import Skeleton from "./Skeleton.vue";

/**
 * The states every asynchronous region has: loading, failed (with a way to retry), empty and
 * loaded. The region's state is one `AsyncState`; the default slot receives the loaded value
 * non-null.
 *
 *   <AsyncSection :state="leads" @retry="reload" :empty-title="t('noLeads')">
 *     <template #default="{ value }"><LeadTable :rows="value" /></template>
 *     <template #empty-actions><Button>Add</Button></template>
 *   </AsyncSection>
 *
 * - loading: skeleton rows (never the word "Loading"), announced as busy.
 * - failed: a banner with the error and a retry button; with a previous value (`stale`) the
 *   content stays below it.
 * - refreshing / stale without an error: a quiet capsule with a spinner or a retry, never a banner.
 * - loaded and empty: an `EmptyState`; the content slot is one stable branch, so forms, selection
 *   and scroll survive a refresh.
 */
const props = withDefaults(defineProps<{
  state: AsyncState<Value>;
  /** What counts as empty for a loaded value; by default null, "", and an empty array. */
  isEmpty?: (value: Value) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: IconName;
  skeletonRows?: number;
}>(), {
  isEmpty: isEmptyValue,
  emptyTitle: undefined,
  emptyDescription: undefined,
  emptyIcon: undefined,
  skeletonRows: 3,
});

defineEmits<{ retry: [] }>();

defineSlots<{
  /** The loaded value, non-null. Also shown while it is refreshing or stale. */
  default?: (scope: { value: Value }) => unknown;
  /** A skeleton of the content; by default `skeletonRows` bars. */
  skeleton?: () => unknown;
  /** The action area of the empty state. */
  "empty-actions"?: () => unknown;
}>();

defineOptions({ inheritAttrs: false });

const { t } = useI18n();

const content = computed(() => {
  const state = props.state;
  if (state.status === "loading" || state.status === "failed") return null;
  if (state.status === "loaded" && props.isEmpty(state.value)) return null;
  return { value: state.value };
});
</script>

<template>
  <div v-if="props.state.status === 'loading'" class="space-y-3" data-async="loading" role="status" aria-busy="true" :aria-label="t('core.state.loading')">
    <slot name="skeleton">
      <Skeleton v-for="n in props.skeletonRows" :key="n" />
    </slot>
  </div>

  <!-- A failed reload keeps the previous content below the banner. -->
  <div v-else-if="props.state.status === 'failed' || (props.state.status === 'stale' && props.state.error)" data-async="failed">
    <Banner tone="warning" role="alert">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p>{{ props.state.error }}</p>
          <p v-if="props.state.status === 'stale'">{{ t("core.state.stale") }}</p>
        </div>
        <Button prominence="secondary" size="sm" @click="$emit('retry')">{{ t("core.actions.retry") }}</Button>
      </div>
    </Banner>
  </div>

  <!-- Content that is refreshing or may be out of date: a quiet capsule, never a banner. -->
  <div v-else-if="props.state.status === 'refreshing' || props.state.status === 'stale'" data-async="stale" role="status"
    :aria-busy="props.state.status === 'refreshing' || undefined"
    class="flex w-fit max-w-full flex-wrap items-center gap-2 rounded-group bg-fill py-1 pr-1 pl-3 text-footnote text-content-muted">
    <Icon :name="props.state.status === 'refreshing' ? 'loader4Line' : 'refreshLine'" :size="14"
      :class="props.state.status === 'refreshing' ? 'animate-spin' : ''" />
    <p class="min-w-0">{{ t(props.state.status === "refreshing" ? "core.state.refreshing" : "core.state.stale") }}</p>
    <Button v-if="props.state.status === 'stale'" prominence="plain" size="xs" @click="$emit('retry')">{{ t("core.actions.retry") }}</Button>
  </div>

  <div v-else-if="!content" data-async="empty">
    <EmptyState :title="props.emptyTitle ?? t('core.state.empty')" :description="props.emptyDescription" :icon="props.emptyIcon">
      <template v-if="$slots['empty-actions']" #actions><slot name="empty-actions" /></template>
    </EmptyState>
  </div>

  <!-- One stable branch for loaded, refreshing and stale content (forms and selection stay alive). -->
  <slot v-if="content" :value="content.value" />
</template>
