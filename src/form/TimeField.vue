<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import DateButton from "../controls/DateButton.vue";
import { useFormat } from "../format";
import { Icon } from "../icon";
import { useCompactPresentation } from "../internal/mediaQuery";
import Popover from "../overlay/Popover.vue";
import { useControlSurface } from "./control";
import DatePickerSheet from "./date/DatePickerSheet.vue";
import QuickChips from "./date/QuickChips.vue";
import type { QuickTime } from "./date/quickPicks";
import { isTime, parseTime, type Time } from "./date/time";
import TimeColumns from "./date/TimeColumns.vue";
import { useTimeText } from "./date/useTimeText";
import { useTypedEntry } from "./date/useTypedEntry";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, type FieldProps, type FieldSlots } from "./field";

/**
 * A time of day on the clock of the user, without a date or a zone: `"14:35"`, or `null`. Typing is forgiving (`1435`,
 * `14.35`, `14:35`, `9`, the word for now); the popover (a drum sheet on a phone) has an hour list 00 to 23 and a minute
 * list with every minute, or every `minuteStep`th, and quick times. A minute that is not a multiple of the step is
 * refused with a message, never moved.
 *
 *   <TimeField v-bind="form.bind('shiftStart')" :label="t('shiftStart')" />
 *   <TimeField v-bind="form.bind('slot')" :label="t('slot')" :minute-step="15" :quick-times="['now', '08:00', '17:00']" />
 */
const props = withDefaults(
  defineProps<
    FieldProps & {
      /** Minutes offered by the lists and accepted when typed: every minute by default. */
      minuteStep?: number;
      /** Shortcuts: `"now"`, a time such as `"08:00"`, or `{ label, time }`. */
      quickTimes?: readonly QuickTime[];
    }
  >(),
  { ...fieldDefaults, minuteStep: 1, quickTimes: undefined },
);

const model = defineModel<string | null>({ default: null });
const emit = defineEmits<{ focus: [event: FocusEvent]; blur: [event: FocusEvent] }>();
const { t } = useI18n();
const format = useFormat();
const compact = useCompactPresentation();
const input = useTemplateRef<HTMLInputElement>("input");
const popover = useTemplateRef<InstanceType<typeof Popover>>("popover");
const panel = useTemplateRef<HTMLElement>("panel");
const sheet = useTemplateRef<InstanceType<typeof DatePickerSheet>>("sheet");

const text = useTimeText(() => props.minuteStep);
const entry = useTypedEntry({ model, display: (value) => value, parse: text.parse });
const shortcuts = computed(() => text.shortcuts(props.quickTimes));

const shownError = computed(() => props.error || entry.message.value);
const surface = useControlSurface("date", () => (shownError.value ? "error" : props.disabled ? "locked" : "rest"));
const shown = computed(() => {
  const parts = parseTime(model.value);
  return parts ? format.time(new Date(2000, 0, 1, parts.hour, parts.minute)) : null;
});
const picked = computed<Time | null>(() => (isTime(entry.typed.value) ? entry.typed.value : isTime(model.value) ? model.value : null));

async function open(intoList: boolean) {
  if (props.disabled) return;
  popover.value?.present();
  if (!intoList) return;
  await nextTick();
  await nextTick();
  panel.value?.querySelector<HTMLElement>("[role=listbox]")?.focus();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    entry.commit();
    popover.value?.dismiss();
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    void open(true);
  }
}

defineExpose({ focus: () => input.value?.focus() });
defineSlots<FieldSlots>();
</script>

<template>
  <Field v-bind="{ ...fieldProps(props), error: shownError }" :value="shown" value-style="numeric">
    <template #default="{ id, describedby, invalid }">
      <template v-if="compact">
        <DateButton v-bind="{ id, 'aria-describedby': describedby }" :disabled="props.disabled" :invalid="invalid" :placeholder="t('core.form.select.choose')" @click="sheet?.present()">
          <template v-if="model">{{ model }}</template>
        </DateButton>
        <DatePickerSheet ref="sheet" :title="props.label ?? t('core.form.time.label')" mode="time" :model-value="model" :shortcuts="shortcuts" :step="props.minuteStep" :clearable="!props.required"
          @update:model-value="entry.set" />
      </template>

      <Popover v-else ref="popover" :label="props.label ?? t('core.form.time.label')" width="sm" placement="bottom-start" :arrow="false" :autofocus="false">
        <template #trigger="{ attrs, presented }">
          <div class="inline-flex max-w-full items-center gap-2" :class="surface">
            <input :id="id" ref="input" v-bind="attrs" type="text" role="combobox" autocomplete="off" size="10" :name="props.name" :value="entry.text.value" :placeholder="text.placeholder.value"
              :disabled="props.disabled" :required="props.required" :aria-required="props.required || undefined" :aria-invalid="invalid || undefined" :aria-describedby="describedby"
              class="block min-h-7 min-w-0 border-0 bg-transparent py-1 pl-2.5 text-body tabular-nums text-content-strong placeholder:text-content-disabled focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
              @input="entry.input(($event.target as HTMLInputElement).value)" @focus="emit('focus', $event)" @blur="entry.commit(); emit('blur', $event)" @keydown="onKeydown" @click="open(false)" />
            <button v-if="!props.disabled" type="button" tabindex="-1" :aria-label="t('core.form.time.open')" class="mr-2 flex shrink-0 cursor-pointer items-center text-content-link" @click="presented ? popover?.dismiss() : open(true)">
              <Icon name="timeLine" :size="18" />
            </button>
          </div>
        </template>

        <template #default="{ dismiss }">
          <div ref="panel" class="flex flex-col gap-2.5">
            <TimeColumns :model-value="picked" :step="props.minuteStep" @update:model-value="entry.set" />
            <QuickChips :items="shortcuts" :selected="picked" @pick="entry.set($event); dismiss()" />
          </div>
        </template>
      </Popover>
    </template>
    <template v-if="$slots.trailing" #trailing><slot name="trailing" /></template>
    <template v-if="$slots.labelTrailing" #labelTrailing><slot name="labelTrailing" /></template>
    <template v-if="$slots.readonly" #readonly><slot name="readonly" /></template>
  </Field>
</template>
