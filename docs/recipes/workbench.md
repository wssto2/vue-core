# A workbench: code beside its preview

A screen that needs the whole viewport (a template editor, a stylesheet, a script) is a `WorkbenchPage`: it fills the space under the shell, has no page scroll and no maximum width, and divides its body into two panes with a draggable divider. Put a `CodeEditor` in one, a `PreviewFrame` in the other, and a `MarkerList` of the server's findings under the code.

<!-- example: docs/examples/workbench/TemplateWorkbench.vue -->
```vue
<script setup lang="ts">
import { PreviewFrame, type PreviewDevice } from "@wssto2/vue-core/content";
import { CodeEditor, MarkerList, type CodeMarker } from "@wssto2/vue-core/form";
import { WorkbenchPage, type PageAction } from "@wssto2/vue-core/page";
import { computed, ref, useTemplateRef } from "vue";

// The server's lint result for the saved source: the browser checks nothing itself.
const props = defineProps<{
  name: string;
  saved: string;
  lint: readonly { line: number; column?: number; level: "error" | "warning"; text: string }[];
  previewUrl: string;
  save: (source: string) => Promise<unknown>;
}>();

const source = ref(props.saved);
const dirty = computed(() => source.value !== props.saved);
const editor = useTemplateRef<InstanceType<typeof CodeEditor>>("editor");
const at = ref({ line: 1, column: 1 });
const device = ref<PreviewDevice>("desktop");
const markers = computed<CodeMarker[]>(() => props.lint.map((finding) => ({ line: finding.line, column: finding.column, severity: finding.level, message: finding.text })));
const save = () => props.save(source.value);
const actions = computed<PageAction[]>(() => [{ id: "save", label: "Save draft", icon: "save", placement: "primary", disabled: !dirty.value, onClick: save }]);
</script>

<template>
  <!-- storage-key remembers where the user dragged the divider; the panes stack below lg. -->
  <WorkbenchPage :title="props.name" :back="{ label: 'Templates', to: '/templates' }" :actions="actions" :dirty="dirty" storage-key="template-editor">
    <template #badges><span class="rounded-full bg-status-warning-surface px-2 py-0.5 text-footnote text-status-warning-content">Draft</span></template>
    <template #start>
      <div class="flex h-full min-h-0 flex-col">
        <div class="flex shrink-0 items-center justify-between border-b border-border-separator px-4 py-2 text-footnote text-content-muted">
          <span>Liquid</span>
          <span>Line {{ at.line }}, column {{ at.column }}</span>
        </div>
        <CodeEditor ref="editor" v-model="source" class="min-h-0 flex-1" fill language="liquid" label="Template" :markers="markers" @cursor="at = $event" @save="save" />
        <div class="max-h-40 shrink-0 overflow-y-auto border-t border-border-separator px-4 py-2">
          <!-- A click on a finding puts the cursor on its line. -->
          <MarkerList :markers="markers" @select="(marker) => editor?.reveal(marker.line, marker.column)" />
        </div>
      </div>
    </template>
    <template #end><PreviewFrame v-model:device="device" :src="props.previewUrl" title="Preview" /></template>
  </WorkbenchPage>
</template>
```

## WorkbenchPage

The header is the one of `EditorPage` and `AdaptivePageShell`: "‹ Back" (or the clickable `path` when the page is deep; `?back=` still wins), the title with `#badges`, a `description` line, the `actions` and a "More" menu for the overflow ones. `usePageChrome()` / `useSaveChrome()` inside the page add to them, and on phones they are in the app's nav bar as everywhere.

| | |
|---|---|
| `title`, `description`, `back`, `path`, `actions`, `documentTitle` | as `AdaptivePageShell` (`PageAction` is the same action model) |
| `dirty` | unsaved changes: "Unsaved changes" beside the actions and the leave question (route change, closing the tab) while it is true |
| `v-model:size`, `storage-key`, `min`, `stack-below` | the divider (see `SplitPane`) |
| `#start`, `#end` | the two panes; without `#end`, `#start` takes the whole body |
| `#badges`, `#leading`, `#subheader`, `#notices` | beside the title, before it (an icon tile), a row under the header (section tabs), above the panes |

From `lg` up the page is exactly as tall as the viewport minus the shell's banner, and each pane scrolls inside itself: give the pane's content `h-full` (the code editor's `fill`). Below `lg` the panes stack and the page scrolls like any other.

## SplitPane

`SplitPane` is the divider on its own, for any two regions.

| | |
|---|---|
| `v-model:size` | the start pane's share, 0 to 1 (default 0.5) |
| `min`, `max` | pixels: the smallest pane (both panes) and the largest start pane |
| `orientation` | `horizontal` (default, side by side) or `vertical` |
| `storage-key` | remembers the size in this browser (`localStorage`, `vue-core:split:<key>`); blocked storage just means it is not remembered |
| `stack-below` | `md`, `lg` (default) or `xl`: below it the panes stack, each at its natural height, with no divider |

The divider is a `role="separator"` you can focus: ←/→ (↑/↓ when vertical) move it by 2 %, Shift by 10 %, Home and End go to the limits. `aria-valuenow` is the start pane's percentage; the name is "Resize panes" in the locale.

## CodeEditor

The editor of `CodeField` without the field: no label row, no error row, no border, in a box you place. `CodeField` is built on it, and its own API did not change.

| | |
|---|---|
| `v-model`, `language`, `readonly`, `line-numbers`, `markers`, `label` | as `CodeField` (`label` is the editor's accessible name) |
| `fill` | the editor takes the height of its parent (give the parent a height); otherwise `height` (default `24rem`) |
| `reveal(line, column?)` | template-ref method: puts the cursor there, scrolls it to the middle and focuses the editor. Asked while the editor is still loading, it is done when it is ready |
| `@cursor` | `{ line, column }` (from 1) whenever the cursor moves, for a readout |
| `@save` | Ctrl/Cmd+S (the browser's own save is suppressed) |
| `@failed` | CodeMirror could not be loaded (the editor shows the message itself) |

It stays lazy: CodeMirror is loaded by `import()` when an editor first shows, and an application that never shows one never loads it.

## MarkerList

The findings of the server's linter (`CodeMarker[]`, the same list the editor underlines) as a list under the code: errors first and warnings second, each group headed by its count in the plural forms of the locale ("1 greška", "2 greške", "5 grešaka"), each finding one button ("Redak 14, stupac 8" and its message) that reports `@select(marker)`. Nothing to list shows "U redu" with a check. Severity is a word and an icon, never colour alone, and the buttons are in the tab order.

The counts need the plural rules of the locale: `createApplication` installs them; a bare `createI18n` needs `pluralRules: slavicPluralRules` (from `@wssto2/vue-core/i18n`).

## PreviewFrame

An iframe of the rendered page, as the visitor sees it. See [the page editor](page-editor.md) for its messages.

| | |
|---|---|
| `src`, `title` | the page, and the iframe's accessible name |
| `v-model:device` | `desktop` (1280 px), `tablet` (768), `mobile` (375): the page is rendered at that width and **scaled down to fit the pane** (never up), and the footer says "Width 1280 px, scaled to 72 %" |
| `sandbox` | default `allow-scripts allow-same-origin allow-forms` |
| `timeout` | milliseconds before a page that has not loaded counts as failed (15000): the error state with "Try again" |
| `#toolbar`, `#footer` | the app's controls before the device switch (a page picker, a language switch); a replacement for the line under the frame (`{ width, scale, device, loadMs }`) |
| `reload()`, `post(message)` | template-ref methods |
| `@load`, `@error`, `@message` | loaded (with the milliseconds), failed, a message from the page |

`sandbox` makes the frame as capable as its own origin: preview a page of your own site, ideally on another origin than the app. A stricter sandbox without `allow-same-origin` gives the page the origin `"null"`; pass `origin="null"` then.
