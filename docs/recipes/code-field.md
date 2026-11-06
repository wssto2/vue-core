# A code editor

`CodeField` edits source code in a form: Liquid templates, HTML, CSS or JavaScript, with highlighting, line numbers, the findings of a linter and an optional preview beside it. It is a field like the others: `v-model` is a string, `form.bind()` gives it the value and the 422 message, and a form with an edited `CodeField` is dirty and guarded on leave.

<!-- example: docs/examples/forms/code/TemplateEditor.vue -->
```vue
<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { CodeField, useForm, type CodeMarker } from "@wssto2/vue-core/form";
import { computed } from "vue";

// The server's lint result for the saved source (`site lint-templates`): the browser checks nothing itself.
const props = defineProps<{
  save: (values: { body: string }) => Promise<unknown>;
  lint: readonly { line: number; column?: number; level: "error" | "warning"; text: string }[];
  previewUrl: string;
}>();

const form = useForm({ defaults: () => ({ body: "<h1>{{ page.title }}</h1>" }) });
const markers = computed<CodeMarker[]>(() => props.lint.map((finding) => ({ line: finding.line, column: finding.column, severity: finding.level, message: finding.text })));
// A 422 from go-core lands under "body" and shows under the editor; Ctrl/Cmd+S in the editor saves too.
const save = () => form.submit((values) => props.save(values));
</script>

<template>
  <CodeField v-bind="form.bind('body')" label="Template" language="liquid" height="32rem" :markers="markers" @save="save">
    <template #preview><iframe :src="props.previewUrl" title="Preview" class="size-full" /></template>
  </CodeField>
  <Button prominence="primary" :processing="form.submitting.value" @click="save">Save</Button>
</template>
```

## Props, events, slots

| | |
|---|---|
| `v-model` | the source (`""` when empty) |
| `language` | `"liquid" \| "html" \| "css" \| "javascript"` (default `"html"`); changing it re-highlights |
| `readonly` | visible and selectable, not editable. A read-mode form (`FormView :editable="false"`) and `disabled` read the same way |
| `lineNumbers` | default `true` |
| `height` | any CSS length, default `24rem`; the user can drag the corner to make it taller |
| `markers` | `{ line, column?, severity: "error" \| "warning", message }[]`, lines and columns from 1: the gutter shows a dot, the line (or the word at `column`) is underlined, the message is on hover |
| `@save` | Ctrl/Cmd+S in the editor (the browser's own save is suppressed) |
| `#preview` | the app's preview, an iframe; the editor goes beside it from `lg` up, and below it on narrower screens behind a "Show preview" button |

Markers are the **server's** findings (the linter is authoritative): the field checks nothing. Pass the new list after each save or lint run.

## Keyboard

Tab indents and Shift+Tab outdents, as in any code editor. A keyboard user is not trapped: **Esc, then Tab** moves on to the next control (any other key gives Tab back to the editor). The hint is under the editor while it edits.

## CodeMirror is an optional peer

The editor is [CodeMirror 6](https://codemirror.net) (MIT), loaded when the first `CodeField` shows; an app that never shows one never loads it. Install what it uses:

```sh
npm i @codemirror/state @codemirror/view @codemirror/commands @codemirror/language @codemirror/lint @lezer/highlight
npm i @codemirror/lang-liquid @codemirror/lang-html @codemirror/lang-css @codemirror/lang-javascript   # the languages you use
```

A language's grammar loads when a field first uses it. Liquid is the official `@codemirror/lang-liquid` (MIT, maintained by the CodeMirror author): HTML with `{{ }}` and `{% %}` highlighted, and `<script>` / `<style>` in their own languages. If a package is missing the field shows "The editor could not be loaded." instead of failing the page.
