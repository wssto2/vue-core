<script setup lang="ts" generic="Value extends string | number">
import { computed, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import Button from "../button/Button.vue";
import { Icon } from "../icon";
import { useCompactPresentation } from "../internal/mediaQuery";
import Sheet from "../modal/Sheet.vue";
import Popover from "../overlay/Popover.vue";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, type FieldProps } from "./field";
import OptionList from "./OptionList.vue";
import { useOptionSource, type OptionsSource } from "./useOptions";

/**
 * Several choices from a list: the chosen ones show as chips (each removable), the list opens to tick and untick.
 * The value is the chosen values, in the order they were chosen; empty is `[]`.
 *
 *   <MultiSelectField v-bind="form.bind('recipients')" :label="t('recipients')" :options="users" />
 *
 * Options from the server (`useOptions`) work as in `SelectField`: a spinner in the control while they load, "Loading…" and "Try
 * again" in the list, and chosen values the new options do not contain are dropped.
 *
 * A few independent on/off choices shown all at once are `ChoiceChips`.
 */
const props = withDefaults(
  defineProps<FieldProps & { options: OptionsSource<Value>; placeholder?: string; searchFrom?: number }>(),
  { ...fieldDefaults, placeholder: undefined, searchFrom: 9 },
);

const model = defineModel<Value[]>({ default: () => [] });
const { t } = useI18n();
const compact = useCompactPresentation();
const sheet = useTemplateRef<{ present: () => void; dismiss: () => void }>("sheet");
const sheetOpen = ref(false);

const choices = useOptionSource(() => props.options, (arrived) => {
  const kept = model.value.filter((value) => arrived.some((option) => option.value === value));
  if (kept.length !== model.value.length) model.value = kept;
});
const chosen = computed(() => model.value.flatMap((value) => choices.known.value.filter((option) => option.value === value)));
const placeholder = computed(() => props.placeholder ?? t("core.form.select.choose"));

function toggle(value: Value | null) {
  if (value === null) return;
  model.value = model.value.includes(value) ? model.value.filter((each) => each !== value) : [...model.value, value];
}
const remove = (value: Value) => (model.value = model.value.filter((each) => each !== value));

const trigger = "inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-control bg-fill px-2.5 py-1 text-body text-content-muted hover:bg-fill-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:cursor-not-allowed disabled:opacity-45";
</script>

<template>
  <Field v-slot="{ id, describedby, invalid }" v-bind="fieldProps(props)" :value="chosen.length ? chosen.map((option) => option.label).join(', ') : null" row-layout="stacked">
    <div class="flex min-w-0 flex-wrap items-center gap-1.5 py-0.5">
      <span v-for="option in chosen" :key="String(option.value)" data-test="chip" class="inline-flex min-h-7 max-w-full items-center gap-1 rounded-full bg-tint-soft pl-3 pr-1 text-subheadline font-medium text-content-link">
        <span class="truncate">{{ option.label }}</span>
        <button type="button" :disabled="props.disabled" :aria-label="`${t('core.form.select.clear')}: ${option.label}`" class="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-fill focus-visible:outline-2 focus-visible:outline-border-focus disabled:cursor-not-allowed" @click="remove(option.value)">
          <Icon name="close" :size="12" />
        </button>
      </span>

      <button v-if="compact" :id="id" type="button" :disabled="props.disabled" aria-haspopup="dialog" :aria-expanded="sheetOpen" :aria-invalid="invalid || undefined" :aria-describedby="describedby" :aria-busy="choices.loading.value || undefined" :class="trigger" @click="sheet?.present()">
        <Icon v-if="choices.loading.value" name="loader4Line" :size="14" class="shrink-0 animate-spin" />
        {{ chosen.length ? t("core.actions.edit") : placeholder }}
      </button>
      <Popover v-else :label="props.label ?? placeholder" width="md" placement="bottom-start" :arrow="false">
        <template #trigger="{ toggle: open, attrs }">
          <button :id="id" type="button" v-bind="attrs" aria-haspopup="listbox" :disabled="props.disabled" :aria-invalid="invalid || undefined" :aria-describedby="describedby" :aria-busy="choices.loading.value || undefined" :class="trigger" @click="open">
            <Icon v-if="choices.loading.value" name="loader4Line" :size="14" class="shrink-0 animate-spin" />
            {{ chosen.length ? t("core.actions.edit") : placeholder }}
          </button>
        </template>
        <div class="max-h-72 overflow-y-auto">
          <OptionList :options="choices.rows.value" :status="choices.status.value" :model-value="model" multiple :search-from="props.searchFrom" presentation="plain" @select="toggle" @retry="choices.reload()" />
        </div>
      </Popover>
    </div>

    <Sheet v-if="compact" ref="sheet" :title="props.label ?? placeholder" grouped @presented="sheetOpen = true" @dismissed="sheetOpen = false">
      <OptionList :options="choices.rows.value" :status="choices.status.value" :model-value="model" multiple :search-from="props.searchFrom" @select="toggle" @retry="choices.reload()" />
      <template #footer>
        <div class="flex items-center justify-between gap-2">
          <Button prominence="plain" :disabled="model.length === 0" @click="model = []">{{ t("core.form.select.clear") }}</Button>
          <Button prominence="primary" @click="sheet?.dismiss()">{{ t("core.form.select.done") }}</Button>
        </div>
      </template>
    </Sheet>
  </Field>
</template>
