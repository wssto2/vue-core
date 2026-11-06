import type { Extension } from "@codemirror/state";

/** What `CodeField` edits. `liquid` is HTML with `{{ }}` and `{% %}` (and the `<script>` / `<style>` of the page highlighted as their own languages). */
export type CodeLanguage = "liquid" | "html" | "css" | "javascript";

/** A finding of the server's linter (`site lint-templates`) shown in the editor: the gutter and an underline. Lines and columns count from 1. */
export interface CodeMarker {
  line: number;
  /** Without it the whole line is marked. */
  column?: number;
  severity: "error" | "warning";
  message: string;
}

/**
 * CodeMirror 6, every package an optional peer dependency (`npm i @codemirror/state @codemirror/view @codemirror/commands
 * @codemirror/language @codemirror/lint`, and `@codemirror/lang-liquid` / `lang-html` / `lang-css` / `lang-javascript` for the
 * languages in use). This file is the only place that imports them and only through `import()`: nothing loads until a `CodeField` shows.
 */
export async function loadCodeEditor() {
  const [state, view, commands, language, lint, highlight] = await Promise.all([
    import("@codemirror/state"),
    import("@codemirror/view"),
    import("@codemirror/commands"),
    import("@codemirror/language"),
    import("@codemirror/lint"),
    import("@lezer/highlight"),
  ]);
  return { state, view, commands, language, lint, highlight };
}

export type CodeEditor = Awaited<ReturnType<typeof loadCodeEditor>>;

/** The grammar of one language, loaded when it is first used. */
export async function loadCodeLanguage(name: CodeLanguage): Promise<Extension> {
  switch (name) {
    case "liquid": return (await import("@codemirror/lang-liquid")).liquid();
    case "html": return (await import("@codemirror/lang-html")).html();
    case "css": return (await import("@codemirror/lang-css")).css();
    case "javascript": return (await import("@codemirror/lang-javascript")).javascript();
  }
}
