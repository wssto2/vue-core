<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import CodeEditor from "./CodeEditor.vue";
import Field from "./Field.vue";
import { type CodeLanguage, type CodeMarker } from "./codeEditor";
import { fieldDefaults, fieldProps, useFieldMode, type FieldProps, type FieldSlots } from "./field";

/**
 * Source code: Liquid templates, HTML, CSS or JavaScript, with highlighting, line numbers and the findings of a linter. The value
 * is the text ("" when empty). The editor is CodeMirror 6, optional peer dependencies loaded when the field first shows
 * (see `loadCodeEditor`); an application that never shows this field never loads them.
 *
 * `markers` come from the server's linter (the browser checks nothing): each is drawn in the gutter and as an underline on its
 * line, with the message on hover. `@save` fires on Ctrl/Cmd+S. Tab indents; Esc, then Tab, moves on to the next control.
 * Give the `preview` slot (an iframe of the rendered page) and the editor sits beside it, below it on narrow screens behind a button.
 *
 *   <CodeField v-model="form.body" language="liquid" :markers="lint" label="Template" @save="save">
 *     <template #preview><iframe :src="previewUrl" title="Preview" class="size-full" /></template>
 *   </CodeField>
 */
const props = withDefaults(
  defineProps<FieldProps & {
    modelValue?: string;
    language?: CodeLanguage;
    /** Visible and selectable, not editable (a read-only viewer of a published version). */
    readonly?: boolean;
    lineNumbers?: boolean;
    /** The height of the editor; the user can drag it taller (any CSS length). */
    height?: string;
    markers?: readonly CodeMarker[];
  }>(),
  { ...fieldDefaults, modelValue: "", language: "html", readonly: false, lineNumbers: true, height: "24rem", markers: () => [] },
);
const emit = defineEmits<{
  "update:modelValue": [source: string];
  /** Ctrl/Cmd+S inside the editor (the browser's own save is suppressed). */
  save: [];
}>();
defineSlots<FieldSlots & {
  /** The app's preview of the code; the editor goes beside it. */
  preview?: () => unknown;
}>();

const { t } = useI18n();
const { editable } = useFieldMode(props);
const editor = useTemplateRef<InstanceType<typeof CodeEditor>>("editor");
const previewOpen = ref(false);
const locked = computed(() => props.readonly || !editable.value || props.disabled);

defineExpose({ focus: () => editor.value?.focus() });
</script>

<template>
  <!-- Always the editor, read-only in a read-mode form: code is not a value row. -->
  <Field v-bind="{ ...fieldProps(props), editable: true, required: props.required && editable }" row-layout="stacked" :value="null">
    <template #default="{ id, describedby }">
      <div class="w-full">
        <button v-if="$slots.preview" type="button" class="mb-2 rounded-md border border-border-control px-2 py-1 text-sm lg:hidden" :aria-expanded="previewOpen" :aria-controls="`${id}-preview`" @click="previewOpen = !previewOpen">
          {{ previewOpen ? t("core.form.code.hide_preview") : t("core.form.code.show_preview") }}
        </button>
        <div class="grid w-full gap-3" :class="{ 'lg:grid-cols-2': $slots.preview }">
          <div>
            <!-- resize needs overflow other than visible; CodeMirror scrolls inside. -->
            <div :id="id" :aria-describedby="describedby" data-code-field class="resize-y overflow-hidden rounded-md border border-border-control bg-surface-cell focus-within:border-border-focus" :style="{ height: props.height }">
              <CodeEditor ref="editor" fill :model-value="props.modelValue" :language="props.language" :readonly="locked" :line-numbers="props.lineNumbers" :markers="props.markers" :label="props.label"
                @update:model-value="emit('update:modelValue', $event)" @save="emit('save')" />
            </div>
            <p v-if="!locked" class="mt-1 text-footnote text-content-muted">{{ t("core.form.code.tab_hint") }}</p>
          </div>
          <div v-if="$slots.preview" :id="`${id}-preview`" :aria-label="t('core.form.code.preview')" role="region" class="min-h-48 overflow-hidden rounded-md border border-border-control" :class="previewOpen ? 'block' : 'hidden lg:block'" :style="{ height: props.height }">
            <slot name="preview" />
          </div>
        </div>
      </div>
    </template>
    <template v-if="$slots.trailing" #trailing><slot name="trailing" /></template>
    <template v-if="$slots.labelTrailing" #labelTrailing><slot name="labelTrailing" /></template>
  </Field>
</template>
