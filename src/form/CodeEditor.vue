<script setup lang="ts">
import type { EditorView } from "@codemirror/view";
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { loadCodeEditor, loadCodeLanguage, type CodeEditor as CodeMirror, type CodeLanguage, type CodeMarker } from "./codeEditor";

/**
 * The editor of `CodeField` without the field around it (no label, no error row, no border): source code in a box that you place
 * yourself, as the pane of a workbench. It is CodeMirror 6, optional peer dependencies loaded when the editor first shows (see
 * `loadCodeEditor`); an application that never shows one never loads them.
 *
 * - `fill`: the editor takes the height of its parent (which must have one); otherwise `height`.
 * - `reveal(line, column?)` (template ref): puts the cursor there, scrolls it into view and focuses the editor. A call made while
 *   the editor is still loading is carried out when it is ready.
 * - `@cursor`: `{ line, column }` (from 1) whenever the cursor moves, for a "Line 14, column 8" readout.
 * - `markers`: the server's findings, drawn in the gutter and as an underline (the browser checks nothing).
 * - `@save`: Ctrl/Cmd+S (the browser's own save is suppressed). Tab indents; Esc, then Tab, moves on to the next control.
 *
 *   <CodeEditor ref="editor" v-model="source" language="liquid" fill :markers="lint" label="Template" @save="save" @cursor="at = $event" />
 *   editor.value?.reveal(14, 8)
 */
const props = withDefaults(defineProps<{
  modelValue?: string;
  language?: CodeLanguage;
  /** Visible and selectable, not editable. */
  readonly?: boolean;
  lineNumbers?: boolean;
  /** The editor takes the height of its parent instead of `height`. */
  fill?: boolean;
  /** Any CSS length; ignored with `fill`. */
  height?: string;
  markers?: readonly CodeMarker[];
  /** The accessible name of the editor. */
  label?: string;
}>(), { modelValue: "", language: "html", readonly: false, lineNumbers: true, fill: false, height: "24rem", markers: () => [], label: undefined });

const emit = defineEmits<{
  "update:modelValue": [source: string];
  /** Ctrl/Cmd+S inside the editor. */
  save: [];
  /** The cursor moved (or the text changed under it); lines and columns count from 1. */
  cursor: [position: { line: number; column: number }];
  /** CodeMirror could not be loaded. */
  failed: [];
}>();

const { t } = useI18n();
const host = useTemplateRef<HTMLElement>("host");
const failed = ref(false);
let view: EditorView | null = null;
let cm: CodeMirror | null = null;
let syncing = false; // a value set from outside is not echoed back
let pendingReveal: [number, number | undefined] | null = null;
const compartments: Record<"language" | "locked" | "numbers", import("@codemirror/state").Compartment | undefined> = { language: undefined, locked: undefined, numbers: undefined };

function lockedExtension() {
  if (!cm) return [];
  return [cm.state.EditorState.readOnly.of(props.readonly), cm.view.EditorView.editable.of(!props.readonly)];
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

function position(target: EditorView) {
  const head = target.state.selection.main.head;
  const line = target.state.doc.lineAt(head);
  return { line: line.number, column: head - line.from + 1 };
}

function reveal(line: number, column?: number) {
  if (!view || !cm) {
    pendingReveal = [line, column];
    return;
  }
  const doc = view.state.doc;
  const target = doc.line(Math.min(Math.max(Math.trunc(line), 1), doc.lines));
  const at = Math.min(target.from + Math.max((column ?? 1) - 1, 0), target.to);
  view.dispatch({ selection: { anchor: at }, effects: cm.view.EditorView.scrollIntoView(at, { y: "center" }) });
  view.focus();
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
            if (update.docChanged && !syncing) {
              const source = update.state.doc.toString();
              if (source !== props.modelValue) emit("update:modelValue", source);
            }
            if (update.selectionSet || update.docChanged) emit("cursor", position(update.view));
          }),
        ],
      }),
    });
    applyMarkers();
    emit("cursor", position(view));
    if (pendingReveal) reveal(...pendingReveal);
    pendingReveal = null;
  } catch {
    failed.value = true;
    emit("failed");
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
watch(() => props.readonly, () => view?.dispatch({ effects: compartments.locked?.reconfigure(lockedExtension()) }));
watch(() => props.lineNumbers, () => view?.dispatch({ effects: compartments.numbers?.reconfigure(numbersExtension()) }));
watch(() => props.language, async (name) => {
  const grammar = await loadCodeLanguage(name);
  view?.dispatch({ effects: compartments.language?.reconfigure(grammar) });
});

defineExpose({ focus: () => view?.focus(), reveal });
</script>

<template>
  <div data-code-editor class="min-h-0 min-w-0 overflow-hidden bg-surface-cell text-content-strong [&_.cm-gutters]:border-r [&_.cm-gutters]:border-border-separator [&_.cm-gutters]:bg-transparent [&_.cm-gutters]:text-content-muted [&_.tok-keyword]:text-content-link [&_.tok-tagName]:text-content-link [&_.tok-string]:text-emerald-700 dark:[&_.tok-string]:text-emerald-400 [&_.tok-comment]:italic [&_.tok-comment]:text-content-muted [&_.tok-number]:text-amber-700 dark:[&_.tok-number]:text-amber-400 [&_.tok-bool]:text-amber-700 dark:[&_.tok-bool]:text-amber-400 [&_.tok-attributeName]:text-violet-700 dark:[&_.tok-attributeName]:text-violet-400 [&_.tok-propertyName]:text-violet-700 dark:[&_.tok-propertyName]:text-violet-400 [&_.tok-meta]:text-content-muted [&_.cm-lintRange-error]:underline [&_.cm-lintRange-error]:decoration-wavy [&_.cm-lintRange-error]:decoration-red-600 [&_.cm-lintRange-warning]:underline [&_.cm-lintRange-warning]:decoration-wavy [&_.cm-lintRange-warning]:decoration-amber-500"
    :class="props.fill ? 'h-full' : ''" :style="props.fill ? undefined : { height: props.height }">
    <div ref="host" class="h-full" :class="{ hidden: failed }" />
    <p v-if="failed" role="alert" class="p-3 text-sm text-status-danger-content">{{ t("core.form.code.failed") }}</p>
  </div>
</template>
