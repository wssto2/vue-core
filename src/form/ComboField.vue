<script setup lang="ts" generic="Value extends string | number">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { isAborted } from "../client";
import { Icon } from "../icon";
import { useAnchoredPosition } from "../overlay/anchored";
import { controlWidth, type ControlWidth } from "../controls";
import { useControlSurface } from "./control";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, useFormGroup, type FieldProps } from "./field";
import { matchOptions, type SelectOption } from "./options";

/**
 * A choice found by typing: a customer, a vehicle, a user. The options are either a fixed list filtered as the user
 * types (`options`), or searched on the server (`search`, from the feature's `api.ts`: the field does no HTTP itself).
 *
 *   <ComboField v-bind="form.bind('customerId')" :label="t('customer')" :search="(query, { signal }) => api.customers(query, { signal })" :selected="customerOption" />
 *
 * Only the latest search lands (an answer for older text, or after a pick, is dropped, and its request aborted); searches
 * wait `debounce` ms after the last key. A saved value's label cannot be searched by id: pass the record's own option as
 * `selected`, or the field shows nothing for it. Leaving the field without picking puts the chosen label back; clearing
 * the text clears the value. Keys: Down and Up move, Enter picks, Escape closes (without closing a dialog around it).
 */
const props = withDefaults(
  defineProps<FieldProps & {
    /** A fixed list, filtered locally. */
    options?: readonly SelectOption<Value>[];
    /** Searches the server; the answer for the text typed. */
    search?: (query: string, context: { signal: AbortSignal }) => Promise<readonly SelectOption<Value>[]>;
    /** The option of the current value when the caller already has it (a saved record's customer). */
    selected?: SelectOption<Value> | null;
    placeholder?: string;
    /** The fewest characters before `search` is asked. */
    minLength?: number;
    /** Milliseconds to wait after the last key before a server search. */
    debounce?: number;
    /** The most options shown. */
    limit?: number;
    width?: Exclude<ControlWidth, "content">;
  }>(),
  { ...fieldDefaults, options: undefined, search: undefined, selected: null, placeholder: undefined, minLength: 1, debounce: 300, limit: 30, width: "md" },
);

const model = defineModel<Value | null>({ default: null });
const emit = defineEmits<{ picked: [option: SelectOption<Value>] }>();

const { t } = useI18n();
const inRow = !!useFormGroup();
const surface = useControlSurface("text", () => (props.error ? "error" : props.disabled ? "locked" : "rest"));
const fieldWidth = computed(() => (inRow ? controlWidth(props.width) : "w-full"));
const input = useTemplateRef<HTMLInputElement>("input");
const anchor = useTemplateRef<HTMLElement>("anchor");
const panel = useTemplateRef<HTMLElement>("panel");

const picked = shallowRef<SelectOption<Value> | null>(null);
const results = shallowRef<readonly SelectOption<Value>[]>([]);
const text = ref("");
const open = ref(false);
const loading = ref(false);
const failed = ref(false);
const highlighted = ref(-1);
let version = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let controller: AbortController | null = null;

const current = computed(() => {
  const value = model.value;
  if (value === null) return null;
  return [picked.value, props.selected, ...(props.options ?? [])].find((option) => option?.value === value) ?? null;
});
watch(current, (option) => {
  if (!open.value) text.value = option?.label ?? "";
}, { immediate: true });

const { style } = useAnchoredPosition(panel, {
  reference: () => anchor.value,
  placement: () => "bottom-start",
  offset: 4,
  padding: 8,
  fit: (floating, available) => {
    floating.style.width = `${anchor.value?.offsetWidth ?? 0}px`;
    floating.style.maxHeight = `${Math.max(120, Math.min(288, available.height))}px`;
  },
});

function cancel() {
  version++;
  controller?.abort();
  controller = null;
  if (timer) clearTimeout(timer);
  timer = null;
  loading.value = false;
}
onBeforeUnmount(cancel);

async function run(query: string) {
  const mine = ++version;
  failed.value = false;
  if (!props.search) {
    results.value = matchOptions(props.options ?? [], query).slice(0, props.limit);
    highlighted.value = -1;
    return;
  }
  if (query.trim().length < props.minLength) {
    results.value = [];
    return;
  }
  controller?.abort();
  controller = new AbortController();
  loading.value = true;
  try {
    const found = await props.search(query, { signal: controller.signal });
    if (mine !== version) return;
    results.value = found.slice(0, props.limit);
    highlighted.value = -1;
  } catch (error) {
    if (mine !== version || isAborted(error)) return;
    results.value = [];
    failed.value = true;
  } finally {
    if (mine === version) loading.value = false;
  }
}

function onInput(event: Event) {
  text.value = (event.target as HTMLInputElement).value;
  open.value = true;
  if (text.value === "") {
    cancel();
    results.value = [];
    model.value = null;
    picked.value = null;
    if (!props.search) void run("");
    return;
  }
  if (timer) clearTimeout(timer);
  if (props.search) timer = setTimeout(() => void run(text.value), props.debounce);
  else void run(text.value);
}

function onFocus() {
  if (props.disabled) return;
  if (!props.search) {
    open.value = true;
    void run("");
  }
}

function choose(option: SelectOption<Value>) {
  cancel();
  picked.value = option;
  model.value = option.value;
  text.value = option.label;
  open.value = false;
  highlighted.value = -1;
  emit("picked", option);
}

function onBlur() {
  // What was typed but not picked is not a choice: the chosen label comes back.
  cancel();
  open.value = false;
  text.value = current.value?.label ?? "";
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && open.value) {
    event.stopPropagation();
    event.preventDefault();
    open.value = false;
    return;
  }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    if (!open.value) {
      open.value = true;
      if (results.value.length === 0) void run(text.value);
      return;
    }
    const last = results.value.length - 1;
    highlighted.value = event.key === "ArrowDown" ? Math.min(highlighted.value + 1, last) : Math.max(highlighted.value - 1, 0);
    void nextTick(() => panel.value?.querySelector("[aria-selected='true']")?.scrollIntoView?.({ block: "nearest" }));
    return;
  }
  if (event.key === "Enter" && open.value) {
    const option = results.value[highlighted.value];
    if (option && !option.disabled) {
      event.preventDefault();
      choose(option);
    }
  }
}

const showPanel = computed(() => open.value && (results.value.length > 0 || loading.value || failed.value || text.value.trim().length >= props.minLength));
defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
  <Field v-slot="{ id, describedby, invalid }" v-bind="fieldProps(props)" :value="current?.label ?? null">
    <div ref="anchor" class="flex items-center gap-1.5" :class="[surface, fieldWidth]">
      <input :id="id" ref="input" role="combobox" type="text" autocomplete="off" :value="text" :name="props.name" :placeholder="props.placeholder" :disabled="props.disabled" :required="props.required"
        aria-autocomplete="list" :aria-expanded="showPanel" :aria-controls="`${id}-list`" :aria-activedescendant="highlighted >= 0 ? `${id}-option-${highlighted}` : undefined" :aria-required="props.required || undefined"
        :aria-invalid="invalid || undefined" :aria-describedby="describedby"
        class="block w-full min-w-0 border-0 bg-transparent px-0 py-1 text-body text-content-strong placeholder:text-content-disabled focus:outline-none focus:ring-0 disabled:cursor-not-allowed" :class="inRow ? 'compact:text-right' : ''"
        @input="onInput" @focus="onFocus" @blur="onBlur" @keydown="onKeydown" />
      <Icon name="search" :size="14" class="shrink-0 text-content-muted" />
    </div>

    <!-- A press on an option must not blur the input first: mousedown is taken here. -->
    <div v-if="showPanel" :id="`${id}-list`" ref="panel" role="listbox" :style="style" data-test="combo-list" class="z-1000 overflow-y-auto rounded-menu bg-surface-overlay p-1 shadow-float" @mousedown.prevent>
      <p v-if="loading" class="px-3 py-2 text-footnote text-content-muted" role="status">{{ t("core.form.select.loading") }}</p>
      <p v-else-if="failed" class="px-3 py-2 text-footnote text-content-destructive" role="alert">{{ t("core.form.select.failed") }}</p>
      <p v-else-if="results.length === 0" class="px-3 py-2 text-footnote text-content-muted">{{ t("core.form.select.no_matches") }}</p>
      <template v-else>
        <div v-for="(option, index) in results" :id="`${id}-option-${index}`" :key="String(option.value)" role="option" :aria-selected="index === highlighted" :aria-disabled="option.disabled || undefined" data-test="combo-option"
          class="flex cursor-pointer items-center gap-3 rounded-control px-3 py-2 text-body" :class="[index === highlighted ? 'bg-tint-soft text-content-link' : 'text-content-strong hover:bg-fill', option.disabled ? 'cursor-not-allowed opacity-45' : '']"
          @mouseenter="highlighted = index" @click="!option.disabled && choose(option)">
          <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
          <span v-if="option.description" class="shrink-0 truncate text-footnote text-content-muted">{{ option.description }}</span>
        </div>
      </template>
    </div>
  </Field>
</template>
