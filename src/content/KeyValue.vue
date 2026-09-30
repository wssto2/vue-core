<script setup lang="ts">
import { computed, useSlots } from "vue";
import { useI18n } from "vue-i18n";

/**
 * One read-only label and value, the app's single style for it: a small muted label over a
 * medium-weight value. Put it inside a `<dl>` (`KeyValueList` does that for a grid). An empty
 * value (null, undefined, "") shows a muted dash, read as "Not entered"; content in the default
 * slot always wins.
 *
 *   <KeyValue :label="t('vin')" :value="vehicle.vin" />
 *   <KeyValue :label="t('price')"><Money :value="price" /></KeyValue>
 */
const props = withDefaults(defineProps<{
  label: string;
  value?: string | number | null;
  /** The value wraps (long notes, addresses) instead of truncating. */
  wrap?: boolean;
}>(), { value: undefined, wrap: true });

defineSlots<{
  default?: () => unknown;
  /** Extra content beside the label (a tooltip icon, a badge). */
  label?: () => unknown;
}>();

const { t } = useI18n();
const slots = useSlots();
const isEmpty = computed(() => !slots.default && (props.value === null || props.value === undefined || props.value === ""));
</script>

<template>
  <div class="min-w-0">
    <dt class="flex items-center gap-1 text-xs text-content-muted">
      {{ props.label }}
      <slot name="label" />
    </dt>
    <dd class="mt-0.5 text-sm font-medium text-content-strong" :class="props.wrap ? 'break-words' : 'truncate'">
      <template v-if="isEmpty">
        <span aria-hidden="true" class="font-normal text-content-disabled">—</span>
        <span class="sr-only">{{ t("core.state.no_value") }}</span>
      </template>
      <slot v-else>{{ props.value }}</slot>
    </dd>
  </div>
</template>
