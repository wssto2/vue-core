<script setup lang="ts">
import type Quill from "quill";
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import Button from "../../button/Button.vue";
import { createPicker } from "../../collection/picker";
import PickerModal from "../../collection/PickerModal.vue";
import Field from "../Field.vue";
import { fieldDefaults, fieldProps, useFieldMode, type FieldProps } from "../field";
import ResourcePickerList from "./ResourcePickerList.vue";
import { thumbnailUrl, type ResourceItem, type ResourceSource } from "./resources";

/**
 * Formatted text: headings, bold, italic, lists, links, a picture from the media library, optionally a video. The value is an
 * HTML string ("" when empty). The editor is Quill 2, an optional peer dependency loaded when the field first shows
 * (`npm i quill`); an application that never shows this field never loads it.
 *
 * The browser does not sanitise: the HTML is what the editor produced, and the server is the one that cleans it before storing.
 *
 *   <RichTextField v-model="form.body" :images="media" video label="Text" />
 */
const props = withDefaults(
  defineProps<FieldProps & {
    modelValue?: string;
    /** The media library for the image button; without it there is no image button. Its `image` URL (else `thumbnail`) is the picture's `src`. */
    images?: ResourceSource;
    /** Shows the video embed button. */
    video?: boolean;
    placeholder?: string;
  }>(),
  { ...fieldDefaults, modelValue: "", images: undefined, video: false, placeholder: undefined },
);
const emit = defineEmits<{ "update:modelValue": [html: string] }>();

const { t } = useI18n();
const { editable } = useFieldMode(props);
const host = useTemplateRef<HTMLElement>("host");
const failed = ref(false);
const ready = ref(false);
const picker = createPicker<ResourceItem>();
const asking = ref<"link" | "video" | null>(null);
const address = ref("");
let quill: Quill | null = null;
let last = ""; // the HTML the editor last produced or was given: an echo of it is not loaded back
let range: { index: number; length: number } | null = null;
const active = ref<Record<string, unknown>>({});

const html = (): string => {
  if (!quill) return "";
  return quill.getText().trim() === "" && !quill.root.querySelector("img, iframe") ? "" : quill.getSemanticHTML();
};

function load(value: string) {
  if (!quill) return;
  quill.setContents(quill.clipboard.convert({ html: value }), "silent");
  last = html();
}

onMounted(async () => {
  try {
    const { default: Editor } = await import("quill");
    if (!host.value) return;
    quill = new Editor(host.value, { modules: { toolbar: false }, placeholder: props.placeholder, readOnly: !editable.value || props.disabled });
  } catch {
    failed.value = true;
    return;
  }
  load(props.modelValue);
  quill.on("text-change", (_delta, _old, source) => {
    last = html();
    if (source === "user") emit("update:modelValue", last);
  });
  quill.on("selection-change", (selected) => {
    if (selected) {
      range = selected;
      active.value = quill?.getFormat(selected) ?? {};
    }
  });
  ready.value = true;
});
onBeforeUnmount(() => quill?.disable());

watch(() => props.modelValue, (value) => {
  if (value !== last) load(value);
});
watch(() => !editable.value || props.disabled, (locked) => quill?.enable(!locked));

const format = (name: string, value: unknown) => {
  if (!quill) return;
  quill.focus();
  const current = quill.getFormat();
  quill.format(name, current[name] === value ? false : value, "user");
  active.value = quill.getFormat();
};
const isOn = (name: string, value: unknown = true) => active.value[name] === value;

function ask(kind: "link" | "video") {
  range = quill?.getSelection() ?? range;
  address.value = "";
  asking.value = kind;
}
async function apply() {
  const target = address.value.trim();
  const kind = asking.value;
  asking.value = null;
  if (!quill || target === "" || !kind) return;
  quill.focus();
  if (range) quill.setSelection(range);
  const at = range ?? { index: quill.getLength(), length: 0 };
  if (kind === "link") quill.format("link", target, "user");
  else quill.insertEmbed(at.index, "video", target, "user");
}
async function insertImage() {
  range = quill?.getSelection() ?? range;
  const item = await picker.pick({ title: t("core.form.dynamic.rich_text.image") });
  if (!item || !quill || !props.images) return;
  const source = { thumbnail: props.images.image ?? props.images.thumbnail };
  quill.insertEmbed(range?.index ?? quill.getLength(), "image", thumbnailUrl(source, item.id), "user");
}

const toolbar = computed(() => [
  { key: "heading", label: t("core.form.dynamic.rich_text.heading"), text: "H", on: isOn("header", 2), run: () => format("header", 2) },
  { key: "bold", label: t("core.form.dynamic.rich_text.bold"), text: "B", on: isOn("bold"), run: () => format("bold", true) },
  { key: "italic", label: t("core.form.dynamic.rich_text.italic"), text: "I", on: isOn("italic"), run: () => format("italic", true) },
  { key: "bullets", label: t("core.form.dynamic.rich_text.bullets"), text: "•", on: isOn("list", "bullet"), run: () => format("list", "bullet") },
  { key: "numbers", label: t("core.form.dynamic.rich_text.numbers"), text: "1.", on: isOn("list", "ordered"), run: () => format("list", "ordered") },
  { key: "link", label: t("core.form.dynamic.rich_text.link"), text: "↗", on: typeof active.value.link === "string", run: () => ask("link") },
  ...(props.images ? [{ key: "image", label: t("core.form.dynamic.rich_text.image"), text: "▣", on: false, run: () => void insertImage() }] : []),
  ...(props.video ? [{ key: "video", label: t("core.form.dynamic.rich_text.video"), text: "▶", on: false, run: () => ask("video") }] : []),
]);
</script>

<template>
  <Field v-bind="fieldProps(props)" row-layout="stacked" :value="null">
    <template #default="{ id }">
      <div class="w-full rounded-control border border-border-separator bg-fill focus-within:border-border-focus">
        <div v-if="editable && !props.disabled" class="flex flex-wrap gap-1 border-b border-border-separator p-1" role="toolbar" :aria-label="props.label">
          <button v-for="item in toolbar" :key="item.key" type="button" :data-tool="item.key" :aria-label="item.label" :title="item.label" :aria-pressed="item.on" :disabled="!ready"
            class="min-w-8 rounded px-2 py-1 text-sm font-medium hover:bg-fill aria-pressed:bg-fill" @mousedown.prevent @click="item.run">{{ item.text }}</button>
        </div>
        <form v-if="asking" class="flex gap-2 border-b border-border-separator p-2" @submit.prevent="apply">
          <input v-model="address" type="url" class="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm" :aria-label="asking === 'link' ? t('core.form.dynamic.rich_text.link_prompt') : t('core.form.dynamic.rich_text.video_prompt')" :placeholder="asking === 'link' ? t('core.form.dynamic.rich_text.link_prompt') : t('core.form.dynamic.rich_text.video_prompt')" />
          <Button type="submit" size="sm">OK</Button>
        </form>
        <p v-if="failed" role="alert" class="p-3 text-sm text-status-danger-content">{{ t("core.form.dynamic.rich_text.failed") }}</p>
        <!-- Quill's own stylesheet is not loaded: the lists and the hidden clipboard are styled here. -->
        <div :id="id" ref="host" class="min-h-32 px-3 py-2 text-sm [&_.ql-clipboard]:absolute [&_.ql-clipboard]:-left-[100000px] [&_.ql-editor]:min-h-28 [&_.ql-editor]:outline-none [&_.ql-editor_h2]:text-lg [&_.ql-editor_h2]:font-semibold [&_.ql-editor_img]:max-w-full [&_.ql-editor_ol]:pl-6 [&_.ql-editor_li[data-list=bullet]]:list-disc [&_.ql-editor_li[data-list=ordered]]:list-decimal [&_.ql-editor_a]:text-content-link [&_.ql-editor_a]:underline [&_.ql-ui]:hidden [&_.ql-editor.ql-blank::before]:text-content-muted [&_.ql-editor.ql-blank::before]:content-[attr(data-placeholder)]" :class="{ hidden: failed }" />
      </div>
      <PickerModal v-if="props.images" :picker="picker">
        <template #default="{ select }">
          <ResourcePickerList :source="props.images" accept="image/*" @select="select" />
        </template>
      </PickerModal>
    </template>
  </Field>
</template>
