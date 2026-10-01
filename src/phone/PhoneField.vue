<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { controlWidth, type ControlWidth } from "../controls";
import { useControlSurface } from "../form/control";
import Field from "../form/Field.vue";
import { fieldDefaults, fieldProps, useFormGroup, type FieldProps } from "../form/field";
import { Icon } from "../icon";
import CountryPicker from "./CountryPicker.vue";
import { phoneDefaultsKey } from "./environment";
import { COMMON_COUNTRIES, countryName, formatInternational, phoneKind, phoneProblem, readPhone, withCountry, type PhoneCountry, type PhoneEntry } from "./phone";

/**
 * A phone number with its country: a picker with the flag and dial code, and the number formatted as it is typed. The value
 * is the stored form, E.164 (`+38591234567`, "" when empty), whatever country is shown. Pasting "+387 61 234 567" switches
 * the country; a number typed without a dial code belongs to the shown country. Once the user leaves it the field says what
 * is wrong with the number ("too short for Bosnia and Herzegovina"), and what it is when it can tell (mobile, landline).
 * A form's validator uses `phoneProblem` / `isValidPhone`: the field shows the problem, only a validator stops the save.
 *
 *   <PhoneField v-bind="form.bind('mobile')" :label="t('mobile')" />
 *   <PhoneField v-bind="form.bind('landline')" default-country="BA" />
 *
 * Read mode shows the number in international form with Call and Message links and Copy; the app adds its own actions
 * (WhatsApp) in the `actions` slot. The default country is the prop, else `phoneDefaultsKey`, else Croatia.
 */
const props = withDefaults(
  defineProps<FieldProps & {
    /** The country of a number typed without a dial code. */
    defaultCountry?: PhoneCountry;
    /** The countries the picker lists first (default Croatia, Bosnia and Herzegovina, Slovenia, Serbia). */
    commonCountries?: readonly PhoneCountry[];
    placeholder?: string;
    width?: Exclude<ControlWidth, "content">;
  }>(),
  { ...fieldDefaults, defaultCountry: undefined, commonCountries: undefined, placeholder: undefined, width: "lg" },
);

const model = defineModel<string>({ default: "" });
defineSlots<{
  /** More read-mode actions after Call, Message and Copy: a WhatsApp link the app builds. */
  actions?: (scope: { number: string; formatted: string }) => unknown;
}>();

const { t, locale } = useI18n();
const defaults = inject(phoneDefaultsKey, {});
const inRow = !!useFormGroup();
const surface = useControlSurface("text", () => (props.error || problem.value ? "error" : props.disabled ? "locked" : "rest"));
const fieldWidth = computed(() => (inRow ? controlWidth(props.width) : "w-full"));
const input = useTemplateRef<HTMLInputElement>("input");

const fallback = computed<PhoneCountry>(() => props.defaultCountry ?? defaults.defaultCountry ?? (props.commonCountries ?? defaults.commonCountries ?? COMMON_COUNTRIES)[0] ?? "HR");
const common = computed(() => props.commonCountries ?? defaults.commonCountries ?? COMMON_COUNTRIES);

const country = shallowRef<PhoneCountry>(fallback.value);
const text = ref("");
let emitted: string | null = null; // what this field last put in the model: its echo is not an outside change

function take(entry: PhoneEntry) {
  country.value = entry.country;
  text.value = entry.text;
}
// An outside change (a record loaded, a reset) replaces the entry; the echo of our own change does not.
watch(() => model.value, (value) => {
  if (value === emitted) return;
  emitted = null;
  take(readPhone(value, country.value));
}, { immediate: true });

function put(entry: PhoneEntry) {
  take(entry);
  emitted = entry.e164;
  model.value = entry.e164;
}

const digitsIn = (value: string) => value.replace(/\D/g, "").length;
/** Puts the caret after the same number of digits it was after: formatting adds and moves spaces around it. */
async function placeCaret(digits: number) {
  await nextTick();
  const element = input.value;
  if (!element || document.activeElement !== element) return;
  element.value = text.value;
  let seen = 0;
  let at = 0;
  while (at < text.value.length && seen < digits) if (/\d/.test(text.value[at++] ?? "")) seen++;
  element.setSelectionRange(at, at);
}

function onInput(event: Event) {
  const element = event.target as HTMLInputElement;
  const caret = element.selectionStart ?? element.value.length;
  let raw = element.value;
  let digitsBefore = digitsIn(raw.slice(0, caret));
  // Deleting a space or a dash changes no digit: it would come straight back; take the digit beside it instead.
  const kind = (event as InputEvent).inputType ?? "";
  if (kind.startsWith("delete") && digitsIn(raw) === digitsIn(text.value) && digitsIn(raw) > 0) {
    const digits = raw.replace(/\D/g, "");
    const drop = kind === "deleteContentForward" ? digitsBefore : digitsBefore - 1;
    if (drop >= 0 && drop < digits.length) {
      raw = (raw.trimStart().startsWith("+") ? "+" : "") + digits.slice(0, drop) + digits.slice(drop + 1);
      digitsBefore = Math.max(0, digitsBefore - (kind === "deleteContentForward" ? 0 : 1));
    }
  }
  put(readPhone(raw, country.value));
  void placeCaret(digitsBefore);
}

function onPaste(event: ClipboardEvent) {
  const pasted = event.clipboardData?.getData("text")?.trim() ?? "";
  if (!/^(\+|00)\d/.test(pasted)) return; // a national number takes the ordinary path
  event.preventDefault();
  put(readPhone(pasted, country.value));
  void nextTick(() => input.value?.setSelectionRange(text.value.length, text.value.length));
}

function onCountry(next: PhoneCountry) {
  put(withCountry({ country: country.value, e164: model.value, text: text.value }, next));
  void nextTick(() => input.value?.focus());
}

// What is wrong is said after the user leaves the field, and kept up to date while they fix it.
const left = ref(false);
const problem = computed(() => (left.value && model.value !== "" ? phoneProblem(model.value) : null));
const message = computed(() => {
  const found = problem.value;
  if (!found) return undefined;
  return found.country ? t(`core.form.phone.${found.kind}`, { country: countryName(found.country, locale.value) }) : t("core.form.phone.invalid_any");
});
const kind = computed(() => (model.value !== "" && !problem.value ? phoneKind(model.value) : undefined));
const formatted = computed(() => formatInternational(model.value));

const copied = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;
async function copy() {
  try {
    await navigator.clipboard.writeText(formatted.value);
  } catch {
    return; // no clipboard here (an insecure page): nothing copied, nothing claimed
  }
  copied.value = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => (copied.value = false), 1800);
}
onBeforeUnmount(() => timer && clearTimeout(timer));

defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
  <Field v-bind="{ ...fieldProps(props), error: props.error ?? message }" :value="model === '' ? null : formatted" value-style="numeric">
    <template #default="{ id, describedby, invalid }">
      <div class="w-full min-w-0">
        <div class="flex items-stretch gap-1.5" :class="fieldWidth">
          <CountryPicker :id="id" :model-value="country" :common="common" :disabled="props.disabled" :surface="`${surface} px-2.5`" @picked="onCountry" />
          <div class="min-w-0 flex-1" :class="surface">
            <input :id="id" ref="input" :value="text" type="tel" inputmode="tel" autocomplete="tel-national" :name="props.name" :placeholder="props.placeholder" :disabled="props.disabled" :required="props.required"
              :aria-required="props.required || undefined" :aria-invalid="invalid || undefined" :aria-describedby="describedby" data-test="phone-input"
              class="block w-full min-w-0 border-0 bg-transparent px-0 py-1 text-body tabular-nums text-content-strong placeholder:text-content-disabled focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
              @input="onInput" @paste="onPaste" @blur="left = true" />
          </div>
        </div>
        <p v-if="kind && !(props.error ?? message)" class="mt-1.5 flex items-center gap-1.5 text-footnote text-status-success-content" data-test="phone-kind">
          <Icon name="checkCustom" :size="14" class="shrink-0" /> {{ t(`core.form.phone.kind_${kind}`) }}
        </p>
      </div>
    </template>

    <template v-if="model !== ''" #readonly>
      <div class="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5" :class="inRow ? 'justify-end' : ''" data-test="phone-read">
        <span class="flex-auto whitespace-nowrap text-body tabular-nums text-content-strong" :class="inRow ? 'text-right' : ''">{{ formatted }}</span>
        <a :href="`tel:${model}`" :aria-label="t('core.form.phone.call')" :title="t('core.form.phone.call')" data-test="phone-call"
          class="flex size-9 shrink-0 items-center justify-center rounded-full bg-tint-soft text-content-link transition-colors duration-motion-fast hover:bg-fill focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus">
          <Icon name="phone" :size="18" />
        </a>
        <a :href="`sms:${model}`" :aria-label="t('core.form.phone.message')" :title="t('core.form.phone.message')" data-test="phone-message"
          class="flex size-9 shrink-0 items-center justify-center rounded-full bg-tint-soft text-content-link transition-colors duration-motion-fast hover:bg-fill focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus">
          <Icon name="message" :size="18" />
        </a>
        <slot name="actions" :number="model" :formatted="formatted" />
        <button type="button" :aria-label="t('core.form.phone.copy')" :title="t('core.form.phone.copy')" data-test="phone-copy"
          class="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-fill text-content-strong transition-colors duration-motion-fast hover:bg-fill-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus" @click="copy">
          <Icon :name="copied ? 'checkCustom' : 'copy'" :size="18" />
        </button>
        <span class="sr-only" role="status">{{ copied ? t("core.form.phone.copied") : "" }}</span>
      </div>
    </template>
  </Field>
</template>
