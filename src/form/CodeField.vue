<script setup lang="ts">
import type { EditorView } from "@codemirror/view";
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import Field from "./Field.vue";
import { loadCodeEditor, loadCodeLanguage, type CodeEditor, type CodeLanguage, type CodeMarker } from "./codeEditor";
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
const host = useTemplateRef<HTMLElement>("host");
const failed = ref(false);
const previewOpen = ref(false);
const locked = computed(() => props.readonly || !editable.value || props.disabled);
let view: EditorView | null = null;
let cm: CodeEditor | null = null;
let syncing = false; // a value set from outside is not echoed back
const compartments: Record<"language" | "locked" | "numbers", import("@codemirror/state").Compartment | undefined> = { language: undefined, locked: undefined, numbers: undefined };

function lockedExtension() {
  if (!cm) return [];
  return [cm.state.EditorState.readOnly.of(locked.value), cm.view.EditorView.editable.of(!locked.value)];
}
const numbersExtension = () => (cm && props.lineNumbers ? [cm.view.lineNumbers(), cm.view.highlightActiveLineGutter()] : []);

function applyMarkers() {
  if (!view || !cm) return;
  const doc = view.state.doc;
  const diagnostics = props.markers.map((marker) => {
    const line = doc.line(Math.min(Math.max(marker.line, 1), doc.lines));
    const from = marker.column ? Math.min(line.from + marker.column - 1, line.to) : line.from;
    // A column marks the word it points into; a line marks all of it.
    const to = marker.column ? Math.max(view!.state.wordAt(from)?.to ?? from + 1, Math.min(from + 1, line.to)) : line.to;
    return { from, to: Math.min(to, doc.length), severity: marker.severity, message: marker.message };
  });
  view.dispatch(cm.lint.setDiagnostics(view.state, diagnostics));
}

onMounted(async () => {
  try {
    cm = await loadCodeEditor();
    const grammar = await loadCodeLanguage(props.language);
    if (!host.value) return;
    const { EditorState, Compartment } = cm.state;
    const { EditorView, keymap } = cm.view;
    compartments.language = new Compartment();
    compartments.locked = new Compartment();
    compartments.numbers = new Compartment();
    // Esc leaves the editor with the next Tab (a keyboard user is not trapped); any other key takes Tab back.
    let leaving = false;
    const indent = (run: (target: EditorView) => boolean) => (target: EditorView) => !leaving && run(target);
    view = new EditorView({
      parent: host.value,
      state: EditorState.create({
        doc: props.modelValue,
        extensions: [
          EditorView.contentAttributes.of({ "aria-label": props.label ?? "", "aria-multiline": "true" }),
          EditorView.domEventHandlers({
            keydown: (event) => {
              if (event.key === "Escape") leaving = true;
              else if (event.key !== "Tab" && event.key !== "Shift") leaving = false;
              return false;
            },
            blur: () => { leaving = false; return false; },
          }),
          keymap.of([
            { key: "Mod-s", preventDefault: true, run: () => { emit("save"); return true; } },
            { key: "Tab", run: indent(cm.commands.indentMore), shift: indent(cm.commands.indentLess) },
            ...cm.commands.defaultKeymap,
            ...cm.commands.historyKeymap,
          ]),
          cm.commands.history(),
          cm.language.indentOnInput(),
          cm.language.bracketMatching(),
          cm.language.syntaxHighlighting(cm.highlight.classHighlighter),
          cm.lint.lintGutter(),
          EditorView.lineWrapping,
          EditorView.theme({ "&": { height: "100%", backgroundColor: "transparent" }, "&.cm-focused": { outline: "none" }, ".cm-scroller": { fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: "0.8125rem" } }),
          compartments.language.of(grammar),
          compartments.locked.of(lockedExtension()),
          compartments.numbers.of(numbersExtension()),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged || syncing) return;
            const source = update.state.doc.toString();
            if (source !== props.modelValue) emit("update:modelValue", source);
          }),
        ],
      }),
    });
    applyMarkers();
  } catch {
    failed.value = true;
  }
});
onBeforeUnmount(() => view?.destroy());

watch(() => props.modelValue, (value) => {
  if (!view || value === view.state.doc.toString()) return;
  syncing = true;
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  syncing = false;
});
watch(() => props.markers, applyMarkers, { deep: true });
watch(locked, () => view?.dispatch({ effects: compartments.locked?.reconfigure(lockedExtension()) }));
watch(() => props.lineNumbers, () => view?.dispatch({ effects: compartments.numbers?.reconfigure(numbersExtension()) }));
watch(() => props.language, async (name) => {
  const grammar = await loadCodeLanguage(name);
  view?.dispatch({ effects: compartments.language?.reconfigure(grammar) });
});

defineExpose({ focus: () => view?.focus() });
</script>

<template>
  <!-- Always the editor, read-only in a read-mode form: code is not a value row. -->
  <Field v-bind="{ ...fieldProps(props), editable: true, required: props.required && editable }" row-layout="stacked" :value="null">
    <template #default="{ id, describedby }">
      <div class="w-full">
        <button v-if="$slots.preview" type="button" class="mb-2 rounded-md border border-border px-2 py-1 text-sm lg:hidden" :aria-expanded="previewOpen" :aria-controls="`${id}-preview`" @click="previewOpen = !previewOpen">
          {{ previewOpen ? t("core.form.code.hide_preview") : t("core.form.code.show_preview") }}
        </button>
        <div class="grid w-full gap-3" :class="{ 'lg:grid-cols-2': $slots.preview }">
          <div>
            <!-- resize needs overflow other than visible; CodeMirror scrolls inside. -->
            <div ref="host" :id="id" :aria-describedby="describedby" data-code-field class="resize-y overflow-hidden rounded-md border border-border bg-surface text-content-strong focus-within:border-border-focus [&_.cm-gutters]:border-r [&_.cm-gutters]:border-border [&_.cm-gutters]:bg-transparent [&_.cm-gutters]:text-content-muted [&_.tok-keyword]:text-content-link [&_.tok-tagName]:text-content-link [&_.tok-string]:text-emerald-700 dark:[&_.tok-string]:text-emerald-400 [&_.tok-comment]:italic [&_.tok-comment]:text-content-muted [&_.tok-number]:text-amber-700 dark:[&_.tok-number]:text-amber-400 [&_.tok-bool]:text-amber-700 dark:[&_.tok-bool]:text-amber-400 [&_.tok-attributeName]:text-violet-700 dark:[&_.tok-attributeName]:text-violet-400 [&_.tok-propertyName]:text-violet-700 dark:[&_.tok-propertyName]:text-violet-400 [&_.tok-meta]:text-content-muted [&_.cm-lintRange-error]:underline [&_.cm-lintRange-error]:decoration-wavy [&_.cm-lintRange-error]:decoration-red-600 [&_.cm-lintRange-warning]:underline [&_.cm-lintRange-warning]:decoration-wavy [&_.cm-lintRange-warning]:decoration-amber-500" :class="{ hidden: failed }" :style="{ height: props.height }" />
            <p v-if="failed" role="alert" class="p-3 text-sm text-critical">{{ t("core.form.code.failed") }}</p>
            <p v-if="!locked" class="mt-1 text-footnote text-content-muted">{{ t("core.form.code.tab_hint") }}</p>
          </div>
          <div v-if="$slots.preview" :id="`${id}-preview`" :aria-label="t('core.form.code.preview')" role="region" class="min-h-48 overflow-hidden rounded-md border border-border" :class="previewOpen ? 'block' : 'hidden lg:block'" :style="{ height: props.height }">
            <slot name="preview" />
          </div>
        </div>
      </div>
    </template>
    <template v-if="$slots.trailing" #trailing><slot name="trailing" /></template>
    <template v-if="$slots.labelTrailing" #labelTrailing><slot name="labelTrailing" /></template>
  </Field>
</template>
