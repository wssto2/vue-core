<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";
import CountryFlag from "../internal/CountryFlag.vue";
import { useAnchoredPosition } from "../overlay/anchored";
import { allCountries, countryName, dialCode, searchCountries, type PhoneCountry } from "./phone";

/**
 * The country of a phone number: a button with the flag and the dial code, and under it a list that starts with the common
 * countries and goes on with all the others; typing in the search line at its foot filters by name or dial code.
 */
const props = defineProps<{
  id: string;
  common: readonly PhoneCountry[];
  disabled: boolean;
  /** The classes of the button's surface, the same as the number's. */
  surface: string;
}>();

const country = defineModel<PhoneCountry>({ required: true });
const emit = defineEmits<{ picked: [country: PhoneCountry] }>();

const { t, locale } = useI18n();
const root = useTemplateRef<HTMLElement>("root");
const trigger = useTemplateRef<HTMLButtonElement>("trigger");
const panel = useTemplateRef<HTMLElement>("panel");
const search = useTemplateRef<HTMLInputElement>("search");
const open = ref(false);
const query = ref("");
const highlighted = ref(0);

const names = computed(() => {
  const display = new Map<PhoneCountry, string>();
  for (const code of allCountries()) display.set(code, countryName(code, locale.value));
  return display;
});
const nameOf = (code: PhoneCountry): string => names.value.get(code) ?? code;

interface Group {
  readonly title: string | null;
  readonly countries: readonly PhoneCountry[];
}
const groups = computed<readonly Group[]>(() => {
  const common = props.common.filter((code) => names.value.has(code));
  if (query.value.trim() !== "") {
    const found = searchCountries(query.value, locale.value, allCountries());
    // the common ones keep the top of a search too
    return [{ title: null, countries: [...found.filter((code) => common.includes(code)), ...found.filter((code) => !common.includes(code))] }];
  }
  const rest = allCountries().filter((code) => !common.includes(code)).sort((a, b) => nameOf(a).localeCompare(nameOf(b), locale.value));
  return [{ title: t("core.form.phone.common"), countries: common }, { title: t("core.form.phone.all"), countries: rest }].filter((group) => group.countries.length > 0);
});
const flat = computed(() => groups.value.flatMap((group) => group.countries));
const offsets = computed(() => groups.value.map((_group, index) => groups.value.slice(0, index).reduce((sum, earlier) => sum + earlier.countries.length, 0)));
const optionId = (code: PhoneCountry) => `${props.id}-country-${code}`;

const { style } = useAnchoredPosition(panel, {
  reference: () => trigger.value,
  placement: () => "bottom-start",
  offset: 4,
  padding: 8,
  fit: (floating, available) => {
    floating.style.width = "min(20rem, calc(100vw - 1rem))";
    floating.style.maxHeight = `${Math.max(200, Math.min(380, available.height))}px`;
  },
});

async function show() {
  if (props.disabled || open.value) return;
  query.value = "";
  highlighted.value = Math.max(0, flat.value.indexOf(country.value));
  open.value = true;
  await nextTick();
  search.value?.focus();
}
function hide(refocus: boolean) {
  open.value = false;
  if (refocus) trigger.value?.focus();
}
function choose(code: PhoneCountry) {
  country.value = code;
  emit("picked", code);
  hide(false);
}
watch(query, () => (highlighted.value = 0));
watch(highlighted, () => void nextTick(() => panel.value?.querySelector("[aria-selected='true']")?.scrollIntoView?.({ block: "nearest" })));

function onFocusout(event: FocusEvent) {
  if (open.value && !root.value?.contains(event.relatedTarget as Node | null)) hide(false);
}
function onSearchKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.stopPropagation(); // closes the list, not the dialog around it
    event.preventDefault();
    hide(true);
  } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    highlighted.value = Math.min(Math.max(highlighted.value + (event.key === "ArrowDown" ? 1 : -1), 0), flat.value.length - 1);
  } else if (event.key === "Enter") {
    event.preventDefault();
    const code = flat.value[highlighted.value];
    if (code) choose(code);
  }
}
function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    void show();
  }
}

defineExpose({ focus: () => trigger.value?.focus() });
</script>

<template>
  <div ref="root" class="shrink-0" @focusout="onFocusout">
    <button :id="`${props.id}-country`" ref="trigger" type="button" :disabled="props.disabled" :aria-label="t('core.form.phone.country', { country: nameOf(country) })" aria-haspopup="listbox" :aria-expanded="open"
      data-test="country-button" class="flex h-full min-h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap text-body font-medium text-content-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus disabled:cursor-not-allowed compact:border-r compact:border-border-separator"
      :class="props.surface" @click="open ? hide(true) : show()" @keydown="onTriggerKeydown">
      <CountryFlag :country="country" />
      <span class="tabular-nums">{{ dialCode(country) }}</span>
      <Icon name="arrowDownSLine" :size="14" class="text-content-muted" />
    </button>

    <div v-if="open" ref="panel" :style="style" data-test="country-list" class="z-1000 flex flex-col overflow-hidden rounded-menu bg-surface-overlay shadow-float">
      <div :id="`${props.id}-countries`" role="listbox" :aria-label="t('core.form.phone.countries')" class="min-h-0 flex-1 overflow-y-auto p-2">
        <template v-for="(group, groupIndex) in groups" :key="group.title ?? 'found'">
          <p v-if="group.title" role="presentation" class="px-2 pb-1 pt-1.5 text-caption font-semibold uppercase text-content-disabled">{{ group.title }}</p>
          <div v-for="(code, index) in group.countries" :id="optionId(code)" :key="code" role="option" :aria-selected="(offsets[groupIndex] ?? 0) + index === highlighted" data-test="country-option" :data-country="code"
            class="flex cursor-pointer items-center gap-2.5 rounded-control px-2 py-2 text-body" :class="(offsets[groupIndex] ?? 0) + index === highlighted ? 'bg-tint-soft' : 'hover:bg-fill'"
            @mousedown.prevent @mouseenter="highlighted = (offsets[groupIndex] ?? 0) + index" @click="choose(code)">
            <CountryFlag :country="code" />
            <span class="min-w-0 flex-1 truncate text-content-strong" :class="code === country ? 'font-semibold' : ''">{{ nameOf(code) }}</span>
            <span class="shrink-0 tabular-nums text-content-muted">{{ dialCode(code) }}</span>
          </div>
        </template>
        <p v-if="flat.length === 0" class="px-3 py-2 text-footnote text-content-muted" role="status">{{ t("core.form.phone.no_match") }}</p>
      </div>
      <div class="border-t border-border-separator px-3 py-2">
        <input ref="search" v-model="query" type="text" role="combobox" autocomplete="off" aria-autocomplete="list" aria-expanded="true" :aria-controls="`${props.id}-countries`"
          :aria-activedescendant="flat[highlighted] ? optionId(flat[highlighted]!) : undefined" :aria-label="t('core.form.phone.search')" :placeholder="t('core.form.phone.search')" data-test="country-search"
          class="block w-full border-0 bg-transparent p-0 text-body text-content-strong placeholder:text-content-muted focus:outline-none focus:ring-0" @keydown="onSearchKeydown" />
      </div>
    </div>
  </div>
</template>
