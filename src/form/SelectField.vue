<script setup lang="ts" generic="Value extends string | number">
import { computed, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import Button from "../button/Button.vue";
import { Icon } from "../icon";
import { useCompactPresentation } from "../internal/mediaQuery";
import Sheet from "../modal/Sheet.vue";
import Popover from "../overlay/Popover.vue";
import { useControlSurface } from "./control";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, useFormGroup, type FieldProps } from "./field";
import OptionList from "./OptionList.vue";
import type { SelectOption } from "./options";

/**
 * One choice from a list. The value is the chosen option's `value`, or `null` for none: a value of `0` or `""`
 * is a choice like any other (options are compared strictly, never by `==`).
 *
 *   <SelectField v-bind="form.bind('status')" :label="t('status')" :options="statuses" />
 *   const statuses = [{ value: "open", label: "Open" }, { value: "closed", label: "Closed" }] as const satisfies readonly SelectOption[];
 *
 * On wide screens the options open in a popover; on phones and touch screens in a bottom sheet. Lists of nine
 * or more get a search box. `clearable` adds a way back to "no value".
 */
const props = withDefaults(
  defineProps<FieldProps & {
    options: readonly SelectOption<Value>[];
    placeholder?: string;
    clearable?: boolean;
    /** Shows the search box from this many options. */
    searchFrom?: number;
  }>(),
  { ...fieldDefaults, placeholder: undefined, clearable: false, searchFrom: 9 },
);

const model = defineModel<Value | null>({ default: null });
const { t } = useI18n();
const compact = useCompactPresentation();
const inRow = !!useFormGroup();
const sheet = useTemplateRef<{ present: () => void; dismiss: () => void }>("sheet");
const sheetOpen = ref(false);

const selected = computed(() => props.options.find((option) => option.value === model.value) ?? null);
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
</script>

<template>
  <Field v-slot="{ id, describedby, invalid }" v-bind="fieldProps(props)" :value="selected?.label ?? null">
    <div class="inline-flex max-w-full min-w-0" :class="surface">
      <button v-if="compact" :id="id" type="button" :disabled="props.disabled" aria-haspopup="dialog" :aria-expanded="sheetOpen" :aria-required="props.required || undefined"
        :aria-invalid="invalid || undefined" :aria-describedby="describedby" :class="triggerClass" @click="sheet?.present()">
        <span class="min-w-0 truncate" :class="selected ? (inRow ? 'text-content-strong compact:text-content-muted' : 'text-content-strong') : 'text-content-disabled'">{{ selected?.label ?? placeholder }}</span>
        <Icon name="expandUpDownLine" :size="14" class="shrink-0 text-content-muted" />
      </button>
      <Popover v-else :label="props.label ?? placeholder" width="md" placement="bottom-start" :arrow="false">
        <template #trigger="{ toggle, attrs }">
          <button :id="id" type="button" v-bind="attrs" aria-haspopup="listbox" :disabled="props.disabled" :aria-required="props.required || undefined" :aria-invalid="invalid || undefined"
            :aria-describedby="describedby" :class="triggerClass" @click="toggle">
            <span class="min-w-0 truncate" :class="selected ? 'text-content-strong' : 'text-content-disabled'">{{ selected?.label ?? placeholder }}</span>
            <Icon name="expandUpDownLine" :size="14" class="shrink-0 text-content-muted" />
          </button>
        </template>
        <template #default="{ dismiss }">
          <div class="max-h-72 overflow-y-auto">
            <OptionList :options="props.options" :model-value="model" :search-from="props.searchFrom" :none-label="props.clearable ? t('core.form.select.clear') : undefined" presentation="plain"
              @select="(value) => { model = value; dismiss(); }" />
          </div>
        </template>
      </Popover>
    </div>

    <Sheet v-if="compact" ref="sheet" :title="props.label ?? placeholder" grouped @presented="sheetOpen = true" @dismissed="sheetOpen = false">
      <OptionList :options="props.options" :model-value="model" :search-from="props.searchFrom" :none-label="props.clearable ? t('core.form.select.clear') : undefined" @select="pick" />
      <template v-if="props.clearable && model !== null" #footer>
        <Button prominence="plain" @click="pick(null)">{{ t("core.form.select.clear") }}</Button>
      </template>
    </Sheet>
  </Field>
</template>
