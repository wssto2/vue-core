<script setup lang="ts" generic="Value extends string | number">
import { computed, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import Tabs from "../controls/Tabs.vue";
import Sheet from "./Sheet.vue";

/** One tab of a `TabbedSheet`. `error` marks it when something inside needs attention (a failed field): `true` says "Has errors", a text says it. */
export interface SheetTab<Value extends string | number = string | number> {
  value: Value;
  label: string;
  error?: boolean | string;
}

/**
 * A `Sheet` whose body is divided into tabs, with one footer for all of them (Save and Cancel apply to the whole form, not to a tab).
 * A tab with an error shows a mark and its text for screen readers, so the user who submits from tab one finds the error on tab four.
 * Every tab's content stays mounted (hidden when not selected) so fields keep their values and their validation; the default slot is
 * called once per tab with its `value`. Sizes, `docked` and the rest of `Sheet` are the same props.
 *
 *   <TabbedSheet ref="sheet" v-model:tab="tab" :tabs="tabs" :title="t('page.settings')" size="lg">
 *     <template #default="{ tab }"><SeoFields v-if="tab === 'seo'" /> …</template>
 *     <template #footer><Button @click="save">{{ t("save") }}</Button></template>
 *   </TabbedSheet>
 *   sheet.value?.present()
 */
const props = withDefaults(defineProps<{
  tabs: readonly SheetTab<Value>[];
  title?: string;
  grouped?: boolean;
  size?: "md" | "lg" | "xl";
  docked?: boolean;
  /** The accessible name of the tab list. Default: the title. */
  tabsLabel?: string;
}>(), { title: undefined, grouped: false, size: "md", docked: false, tabsLabel: undefined });

const tab = defineModel<Value>("tab", { required: true });
defineEmits<{ presented: []; dismissed: [] }>();
defineSlots<{
  default?: (scope: { tab: Value }) => unknown;
  footer?: () => unknown;
  actions?: () => unknown;
}>();

const { t } = useI18n();
const sheet = useTemplateRef<InstanceType<typeof Sheet>>("sheet");
const items = computed(() =>
  props.tabs.map((item) => ({
    value: item.value,
    label: item.label,
    ...(item.error ? { warning: typeof item.error === "string" ? item.error : t("core.sheet.tab_error") } : {}),
  })),
);

defineExpose({ present: () => sheet.value?.present(), dismiss: () => sheet.value?.dismiss() });
</script>

<template>
  <Sheet ref="sheet" :title="props.title" :grouped="props.grouped" :size="props.size" :docked="props.docked" @presented="$emit('presented')" @dismissed="$emit('dismissed')">
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    <Tabs v-model="tab" :tabs="items" stretch :label="props.tabsLabel ?? props.title ?? t('core.sheet.tabs')">
      <div v-for="item in props.tabs" v-show="item.value === tab" :key="item.value" :data-tab-panel="String(item.value)">
        <slot :tab="item.value" />
      </div>
    </Tabs>
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </Sheet>
</template>
