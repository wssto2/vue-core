<script setup lang="ts" generic="Value extends string | number, Clearable extends boolean = false">
import { computed, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import Button from "../button/Button.vue";
import { Icon } from "../icon";
import { useCompactPresentation } from "../internal/mediaQuery";
import ToneDot from "../state/ToneDot.vue";
import Sheet from "../modal/Sheet.vue";
import Popover from "../overlay/Popover.vue";
import { useControlSurface } from "./control";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, useFormGroup, type FieldProps, type FieldSlots } from "./field";
import OptionList from "./OptionList.vue";
import type { SelectOption } from "./options";
import { useOptionSource, type OptionsSource } from "./useOptions";

/**
 * One choice from a list. The value is the chosen option's `value`, or `null` for none: a value of `0` or `""`
 * is a choice like any other (options are compared strictly, never by `==`).
 *
 *   <SelectField v-bind="form.bind('status')" :label="t('status')" :options="statuses" />
 *   const statuses = [{ value: "open", label: "Open" }, { value: "closed", label: "Closed" }] as const satisfies readonly SelectOption[];
 *
 * On wide screens the options open in a popover; on phones and touch screens in a bottom sheet. Lists of nine
 * or more get a search box. `clearable` adds a way back to "no value".
 *
 * The type says what the select hands back: without `clearable` the user can only pick, so it emits a `Value` and binds a field
 * that is never null; with `clearable` it emits `Value | null`. It still accepts `null` as the value (a select that starts empty
 * shows its placeholder). Exception: options that load (`useOptions`) drop a value the new options lack, so a field bound to a
 * select with changing options should be able to hold `null`.
 *
 * Options from the server (`useOptions`, say the models of the chosen make) work the same way: the field keeps its label and
 * value and shows a spinner while they load, the opened list says "Loading…" or offers "Try again", and a value the new options
 * do not contain is cleared, but only once the options of a different input land: a saved value the first answer lacks (a
 * discontinued model) stays, and shows `selected`'s label.
 *
 *   <SelectField v-bind="form.bind('model')" :label="t('model')" :options="models" :selected="record.modelOption" />
 */
const props = withDefaults(
  defineProps<FieldProps & {
    options: OptionsSource<Value>;
    /** The option of the current value when the caller already has it (a saved record's model): its label shows before the options arrive, or when they do not contain it. */
    selected?: SelectOption<Value> | null;
    placeholder?: string;
    clearable?: Clearable;
    modelValue?: Value | null;
    /** Shows the search box from this many options. */
    searchFrom?: number;
  }>(),
  { ...fieldDefaults, selected: null, placeholder: undefined, clearable: undefined, modelValue: undefined, searchFrom: 9 },
);

const emit = defineEmits<{ "update:modelValue": [value: Clearable extends true ? Value | null : Value] }>();
// Uncontrolled use (no v-model) keeps its own value; the emitted type is narrower than what the internals pass.
const local = ref<Value | null>(props.modelValue ?? null);
watch(() => props.modelValue, (next) => (local.value = next ?? null));
const model = computed<Value | null>({
  get: () => local.value,
  set: (next) => {
    local.value = next;
    emit("update:modelValue", next as Clearable extends true ? Value | null : Value);
  },
});
const { t } = useI18n();
const compact = useCompactPresentation();
const inRow = !!useFormGroup();
const sheet = useTemplateRef<{ present: () => void; dismiss: () => void }>("sheet");
const sheetOpen = ref(false);

const choices = useOptionSource(() => props.options, (arrived) => {
  if (model.value !== null && !arrived.some((option) => option.value === model.value)) model.value = null;
});
const selected = computed(() => choices.known.value.find((option) => option.value === model.value) ?? (props.selected?.value === model.value ? props.selected : null));
const placeholder = computed(() => props.placeholder ?? t("core.form.select.choose"));
const surface = useControlSurface("popup", () => (props.error ? "error" : props.disabled ? "locked" : "rest"));

function pick(value: Value | null) {
  model.value = value;
  sheet.value?.dismiss();
}

const triggerClass = computed(() => [
  "flex max-w-full min-w-0 items-center gap-1.5 py-1 pl-2.5 pr-2 text-body focus-visible:outline-none",
  inRow ? "compact:pl-0 compact:pr-0" : "",
  props.disabled ? "cursor-not-allowed" : "cursor-pointer",
]);
defineSlots<FieldSlots>();
</script>

<template>
  <Field v-bind="fieldProps(props)" :value="selected?.label ?? null">
    <template #default="{ id, describedby, invalid }">
      <div class="inline-flex max-w-full min-w-0" :class="surface">
        <button v-if="compact" :id="id" type="button" :disabled="props.disabled" aria-haspopup="dialog" :aria-expanded="sheetOpen" :aria-required="props.required || undefined"
          :aria-invalid="invalid || undefined" :aria-describedby="describedby" :aria-busy="choices.loading.value || undefined" :class="triggerClass" @click="sheet?.present()">
          <ToneDot v-if="selected?.dot" :tone="selected.dot" />
          <span class="min-w-0 truncate" :class="selected ? (inRow ? 'text-content-strong compact:text-content-muted' : 'text-content-strong') : 'text-content-disabled'">{{ selected?.label ?? placeholder }}</span>
          <Icon :name="choices.loading.value ? 'loader4Line' : 'expandUpDownLine'" :size="14" class="shrink-0 text-content-muted" :class="choices.loading.value ? 'animate-spin' : ''" />
        </button>
        <Popover v-else :label="props.label ?? placeholder" width="md" match-trigger-width placement="bottom-start" :arrow="false">
          <template #trigger="{ toggle, attrs }">
            <button :id="id" type="button" v-bind="attrs" aria-haspopup="listbox" :disabled="props.disabled" :aria-required="props.required || undefined" :aria-invalid="invalid || undefined"
              :aria-describedby="describedby" :aria-busy="choices.loading.value || undefined" :class="triggerClass" @click="toggle">
              <ToneDot v-if="selected?.dot" :tone="selected.dot" />
              <span class="min-w-0 truncate" :class="selected ? 'text-content-strong' : 'text-content-disabled'">{{ selected?.label ?? placeholder }}</span>
              <Icon :name="choices.loading.value ? 'loader4Line' : 'expandUpDownLine'" :size="14" class="shrink-0 text-content-muted" :class="choices.loading.value ? 'animate-spin' : ''" />
            </button>
          </template>
          <template #default="{ dismiss }">
            <div class="max-h-72 overflow-y-auto">
              <OptionList :options="choices.rows.value" :status="choices.status.value" :model-value="model" :search-from="props.searchFrom" :none-label="props.clearable ? t('core.form.select.clear') : undefined" presentation="plain"
                @select="(value) => { model = value; dismiss(); }" @retry="choices.reload()" />
            </div>
          </template>
        </Popover>
      </div>

      <Sheet v-if="compact" ref="sheet" :title="props.label ?? placeholder" grouped @presented="sheetOpen = true" @dismissed="sheetOpen = false">
        <OptionList :options="choices.rows.value" :status="choices.status.value" :model-value="model" :search-from="props.searchFrom" :none-label="props.clearable ? t('core.form.select.clear') : undefined" @select="pick" @retry="choices.reload()" />
        <template v-if="props.clearable && model !== null" #footer>
          <Button prominence="plain" @click="pick(null)">{{ t("core.form.select.clear") }}</Button>
        </template>
      </Sheet>
    </template>
    <template v-if="$slots.trailing" #trailing><slot name="trailing" /></template>
    <template v-if="$slots.labelTrailing" #labelTrailing><slot name="labelTrailing" /></template>
    <template v-if="$slots.readonly" #readonly><slot name="readonly" /></template>
  </Field>
</template>
