<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";
import { Menu, Popover, type MenuItem } from "../overlay";
import ToneDot from "../state/ToneDot.vue";
import { isEmptyFilterValue, type FilterDescriptor } from "./filters";

/**
 * One filter of the toolbar as a capsule: a `select` opens a menu of its options (the current one
 * checked), a `text` filter opens a small field for a free value. Applied: a soft brand tint.
 * Emits `update` with the new value, or null to clear.
 */
const props = defineProps<{
  filter: FilterDescriptor;
  value: string | undefined;
}>();

const emit = defineEmits<{ update: [value: string | null] }>();

const { t } = useI18n();

// Values arrive as text (the URL), options may hold numbers: compare as text. 0 is a value, not "empty".
const selected = computed(() => (isEmptyFilterValue(props.value) ? null : String(props.value)));
const selectedOption = computed(() => props.filter.options?.find((option) => String(option.value) === selected.value) ?? null);

const items = computed<MenuItem[]>(() => {
  const all: MenuItem[] = props.filter.withoutDefaultOption
    ? []
    : [{ id: "__all", label: props.filter.defaultOptionTitle ?? t("core.collection.filters.show_all"), checked: selected.value === null, onSelect: () => emit("update", null) }];
  return [
    ...all,
    ...(props.filter.options ?? []).map((option) => ({
      id: `option-${String(option.value)}`,
      label: option.label,
      icon: option.icon,
      dot: option.dot,
      checked: selected.value === String(option.value),
      onSelect: () => emit("update", String(option.value)),
    })),
  ];
});

const label = computed(() => (props.filter.type === "text" && selected.value ? `${props.filter.label}: ${selected.value}` : (selectedOption.value?.label ?? props.filter.label)));
const applied = computed(() => selected.value !== null);

// Written out so Tailwind generates every class.
const CHIP = "inline-flex shrink-0 cursor-pointer items-center gap-x-2 rounded-button px-3 py-1.5 text-subheadline transition-colors duration-motion-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";
const chipTone = computed(() =>
  applied.value
    ? "bg-tint-soft font-semibold text-content-link"
    : "bg-surface-cell font-medium text-content-strong ring-1 ring-inset ring-border-separator hover:bg-fill",
);

// --- text filter ---------------------------------------------------------------

const draft = ref("");
const popover = useTemplateRef<InstanceType<typeof Popover>>("popover");
watch(selected, (value) => (draft.value = value ?? ""), { immediate: true });

function applyDraft() {
  const value = draft.value.trim();
  emit("update", value === "" ? null : value);
  popover.value?.dismiss();
}

function clearDraft() {
  draft.value = "";
  emit("update", null);
  popover.value?.dismiss();
}

const field = useTemplateRef<HTMLInputElement>("field");
async function focusField() {
  await nextTick();
  field.value?.focus();
}
</script>

<template>
  <Popover v-if="props.filter.type === 'text'" ref="popover" :label="props.filter.label" width="md" placement="bottom-start" @presented="focusField">
    <template #trigger="{ toggle, attrs }">
      <button v-bind="attrs" type="button" :class="[CHIP, chipTone]" @click="toggle">
        <Icon v-if="props.filter.icon" :name="props.filter.icon" :size="16" />
        <span class="max-w-56 truncate">{{ label }}</span>
        <Icon name="arrowDownSLine" :size="16" class="text-content-muted" />
      </button>
    </template>
    <form class="flex flex-col gap-3" @submit.prevent="applyDraft">
      <label class="flex flex-col gap-1.5 text-footnote font-medium text-content-muted">
        {{ props.filter.label }}
        <input ref="field" v-model="draft" type="text" autocomplete="off" :placeholder="t('core.collection.filters.type_to_filter')"
          class="rounded-control bg-fill px-2.5 py-1.5 text-body text-content-strong outline-none placeholder:text-content-disabled focus:bg-surface-cell focus:ring-[1.5px] focus:ring-inset focus:ring-border-focus" />
      </label>
      <div class="flex items-center justify-between gap-2">
        <button type="button" class="cursor-pointer rounded-control px-2 py-1 text-footnote text-content-muted hover:text-content-strong" @click="clearDraft">
          {{ t("core.collection.filters.clear") }}
        </button>
        <button type="submit" class="cursor-pointer rounded-control bg-tint px-3 py-1.5 text-footnote font-semibold text-content-on-tint">
          {{ t("core.collection.filters.apply") }}
        </button>
      </div>
    </form>
  </Popover>

  <Menu v-else :items="items" :label="props.filter.label" placement="bottom-start">
    <template #trigger="{ toggle, attrs }">
      <button v-bind="attrs" type="button" :class="[CHIP, chipTone]" @click="toggle">
        <Icon v-if="props.filter.icon" :name="props.filter.icon" :size="16" />
        <ToneDot v-if="selectedOption?.dot" :tone="selectedOption.dot" />
        <span class="max-w-56 truncate">{{ label }}</span>
        <Icon name="arrowDownSLine" :size="16" class="text-content-muted" />
      </button>
    </template>
  </Menu>
</template>
