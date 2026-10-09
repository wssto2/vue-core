<script setup lang="ts">
import { computed, inject, nextTick, ref, useId, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { applicationKey } from "../app/environment";
import { Icon } from "../icon";
import { useControlSurface } from "./control";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, useFieldMode, type FieldProps, type FieldSlots } from "./field";
import { missingLocales, type I18nText } from "./i18nText";

/**
 * One text in several languages: the title of an advert, a product name. A segment per language sits next to the label,
 * a dot on each says whether it is written; the value is `Record<locale, string>` ("" is not written yet).
 *
 *   <I18nField v-bind="form.bind('title')" :label="t('title')" :required-locales="['hr']" />
 *
 * The languages are the app's (`createApplication`'s `locale.supported`), or `locales`; the first, or `defaultLocale` (which is
 * then shown first), is the one "Copy into empty ones" copies from. `required-locales` says which must be written: leaving the field while one is
 * empty reports it under the field whichever tab is open (a form's validator uses `missingLocales` to stop the save).
 * Reading shows the current language (or the default's), with the others under "N more languages". `multiline` is the
 * textarea variant.
 */
const props = withDefaults(
  defineProps<FieldProps & {
    locales?: readonly string[];
    defaultLocale?: string;
    requiredLocales?: readonly string[];
    multiline?: boolean;
    rows?: number;
    placeholder?: string;
    maxLength?: number;
  }>(),
  { ...fieldDefaults, locales: undefined, defaultLocale: undefined, requiredLocales: () => [], multiline: false, rows: 3, placeholder: undefined, maxLength: undefined },
);

const model = defineModel<I18nText>({ default: () => ({}) });

const { t, locale: uiLocale, availableLocales } = useI18n();
const application = inject(applicationKey, null);
const baseId = useId();
const field = useTemplateRef<HTMLInputElement | HTMLTextAreaElement>("field");
const root = useTemplateRef<HTMLElement>("root");
const { editable } = useFieldMode(props);
const surface = useControlSurface(props.multiline ? "area" : "text", () => (props.error || ownError.value ? "error" : props.disabled ? "locked" : "rest"));

const known = computed(() => props.locales ?? application?.locales ?? availableLocales);
const fallback = computed(() => props.defaultLocale ?? known.value[0] ?? "");
// The default language comes first: it is the one the others are copied from.
const list = computed(() => (known.value.includes(fallback.value) ? [fallback.value, ...known.value.filter((locale) => locale !== fallback.value)] : known.value));
const chosen = ref<string | null>(null);
const active = computed(() => (chosen.value !== null && list.value.includes(chosen.value) ? chosen.value : list.value.includes(uiLocale.value) ? uiLocale.value : fallback.value));

const textOf = (locale: string): string => model.value[locale] ?? "";
const written = (locale: string): boolean => textOf(locale).trim() !== "";
const code = (locale: string): string => locale.toUpperCase();
function nameOf(locale: string): string {
  try {
    return new Intl.DisplayNames([uiLocale.value], { type: "language" }).of(locale) ?? code(locale);
  } catch {
    return code(locale);
  }
}
const listed = (locales: readonly string[]): string => locales.map(nameOf).join(", ");

function set(locale: string, text: string) {
  model.value = { ...model.value, [locale]: text };
}
const tabId = (locale: string) => `${baseId}-tab-${locale}`;

function choose(locale: string, focusField: boolean) {
  chosen.value = locale;
  if (focusField) void nextTick(() => field.value?.focus());
}
function onTabKeydown(event: KeyboardEvent, index: number) {
  const last = list.value.length - 1;
  const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: last }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  const target = list.value[(next + list.value.length) % list.value.length];
  if (target === undefined) return;
  choose(target, false);
  void nextTick(() => document.getElementById(tabId(target))?.focus());
}

// "Required" is reported once the user has left the field: not while they are still on their way to the other tab.
const left = ref(false);
function onFocusout(event: FocusEvent) {
  if (!root.value?.contains(event.relatedTarget as Node | null)) left.value = true;
}
const lacking = computed(() => missingLocales(model.value, props.requiredLocales));
const ownError = computed(() => (left.value && lacking.value.length > 0 ? t("core.form.i18n.required", { languages: listed(lacking.value) }) : undefined));
// For the page's required-field progress: whole when every required language is written (or, with none required, any is).
const complete = computed(() => (props.requiredLocales.length > 0 ? lacking.value.length === 0 : list.value.some(written)));
const empty = computed(() => list.value.filter((locale) => !written(locale) && !(ownError.value && lacking.value.includes(locale))));
const canCopy = computed(() => written(fallback.value) && list.value.some((locale) => locale !== fallback.value && !written(locale)));
function copyIntoEmpty() {
  const text = textOf(fallback.value);
  model.value = { ...model.value, ...Object.fromEntries(list.value.filter((locale) => !written(locale)).map((locale) => [locale, text])) };
}

// Reading: the current language, else the default's, else the first that is written.
const shown = computed(() => [uiLocale.value, fallback.value, ...list.value].find((locale) => list.value.includes(locale) && written(locale)));
const others = computed(() => list.value.filter((locale) => locale !== shown.value));
const filledOthers = computed(() => others.value.filter(written).length);
const more = ref(false);
const fieldLabel = computed(() => (props.label && !editable.value && shown.value ? `${props.label} · ${code(shown.value)}` : props.label));

defineExpose({ focus: () => field.value?.focus() });
defineSlots<Pick<FieldSlots, "trailing">>();
</script>

<template>
  <Field v-bind="{ ...fieldProps(props), label: fieldLabel, error: props.error ?? ownError, required: props.required || props.requiredLocales.length > 0 }" :value="editable ? (complete ? 'written' : null) : shown ? textOf(shown) : null" row-layout="stacked">
    <template #default="{ id, describedby, invalid }">
    <div ref="root" class="w-full" @focusout="onFocusout">
      <div :id="`${baseId}-panel`" role="tabpanel" :aria-labelledby="tabId(active)">
        <div class="w-full" :class="surface">
          <textarea v-if="props.multiline" :id="id" ref="field" :value="textOf(active)" :lang="active" :name="props.name" :rows="props.rows" :placeholder="props.placeholder" :maxlength="props.maxLength" :disabled="props.disabled"
            :aria-required="props.required || undefined" :aria-invalid="invalid || undefined" :aria-describedby="describedby" data-test="i18n-input"
            class="block w-full resize-y border-0 bg-transparent px-0 py-1 text-body text-content-strong placeholder:text-content-disabled focus:outline-none focus:ring-0 disabled:cursor-not-allowed" @input="set(active, ($event.target as HTMLTextAreaElement).value)"></textarea>
          <input v-else :id="id" ref="field" :value="textOf(active)" :lang="active" type="text" :name="props.name" :placeholder="props.placeholder" :maxlength="props.maxLength" :disabled="props.disabled"
            :aria-required="props.required || undefined" :aria-invalid="invalid || undefined" :aria-describedby="describedby" data-test="i18n-input"
            class="block w-full min-w-0 border-0 bg-transparent px-0 py-1 text-body text-content-strong placeholder:text-content-disabled focus:outline-none focus:ring-0 disabled:cursor-not-allowed" @input="set(active, ($event.target as HTMLInputElement).value)" />
        </div>
      </div>
      <div v-if="empty.length > 0 || canCopy" class="mt-1.5 flex items-center gap-2">
        <p v-if="empty.length > 0" class="flex-1 text-footnote text-status-warning-content" data-test="i18n-missing">{{ t("core.form.i18n.missing", { languages: listed(empty) }) }}</p>
        <span v-else class="flex-1"></span>
        <button v-if="canCopy && !props.disabled" type="button" data-test="i18n-copy"
          class="shrink-0 cursor-pointer rounded-control bg-tint-soft px-2.5 py-1.5 text-footnote font-medium text-content-link transition-colors duration-motion-fast hover:bg-fill focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus" @click="copyIntoEmpty">
          {{ t("core.form.i18n.copy", { language: code(fallback) }) }}
        </button>
      </div>
    </div>
    </template>

    <template #labelTrailing>
      <div role="tablist" :aria-label="t('core.form.i18n.languages')" class="flex shrink-0 gap-0.5 rounded-control bg-fill p-0.5" data-test="i18n-tabs">
        <button v-for="(locale, index) in list" :id="tabId(locale)" :key="locale" type="button" role="tab" :aria-selected="locale === active" :tabindex="locale === active ? 0 : -1" :aria-controls="`${baseId}-panel`"
          :aria-label="t(written(locale) ? 'core.form.i18n.tab_written' : 'core.form.i18n.tab_empty', { language: nameOf(locale) })" :title="nameOf(locale)"
          class="flex min-h-7 cursor-pointer items-center gap-1.5 rounded-control px-2.5 py-1 text-footnote font-semibold transition-colors duration-motion-fast focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus"
          :class="locale === active ? 'bg-segment-selected text-content-strong shadow-sm' : 'text-content-muted hover:text-content-strong'" @click="choose(locale, true)" @keydown="onTabKeydown($event, index)">
          {{ code(locale) }}
          <span aria-hidden="true" class="size-1.5 rounded-full" data-test="i18n-dot" :data-state="written(locale) ? 'written' : ownError && lacking.includes(locale) ? 'required' : 'empty'"
            :class="written(locale) ? 'bg-status-success-solid' : ownError && lacking.includes(locale) ? 'bg-content-destructive' : 'bg-content-disabled'"></span>
        </button>
      </div>
    </template>

    <template v-if="shown" #readonly>
      <div class="w-full">
        <p class="whitespace-pre-line break-words text-body text-content-strong">{{ textOf(shown) }}</p>
        <template v-if="others.length > 0">
          <button type="button" :aria-expanded="more" class="mt-1.5 flex w-full cursor-pointer items-center gap-2 text-left text-footnote text-content-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus" @click="more = !more">
            <span class="flex-1">{{ t("core.form.i18n.more", { count: others.length, filled: filledOthers }) }}</span>
            <Icon name="arrowRightSLine" :size="16" class="shrink-0 transition-transform duration-motion-fast" :class="more ? 'rotate-90' : ''" />
          </button>
          <dl v-if="more" class="mt-1 flex flex-col gap-1.5">
            <div v-for="locale in others" :key="locale" class="flex gap-2 text-body">
              <dt class="w-8 shrink-0 text-footnote font-semibold leading-6 text-content-muted" :title="nameOf(locale)">{{ code(locale) }}</dt>
              <dd class="min-w-0 flex-1 whitespace-pre-line break-words" :class="written(locale) ? 'text-content-strong' : 'text-content-disabled'">{{ written(locale) ? textOf(locale) : t("core.state.no_value") }}</dd>
            </div>
          </dl>
        </template>
      </div>
    </template>
    <template v-if="$slots.trailing" #trailing><slot name="trailing" /></template>
  </Field>
</template>
