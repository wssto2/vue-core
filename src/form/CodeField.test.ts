import { EditorView } from "@codemirror/view";
import { fireEvent, render, waitFor } from "@testing-library/vue";
import { readFileSync } from "node:fs";
import { createI18n } from "vue-i18n";
import { defineComponent, h, ref } from "vue";
import { describe, expect, it } from "vitest";
import { coreMessages } from "../i18n";
import CodeField from "./CodeField.vue";
import { useForm } from "./useForm";
import type { CodeMarker } from "./codeEditor";

const i18n = createI18n({ legacy: false, locale: "en", messages: coreMessages });
const global = { plugins: [i18n] };
const ready = () => waitFor(() => expect(document.querySelector(".cm-content")).not.toBeNull(), { timeout: 10_000 });
const content = () => document.querySelector(".cm-content") as HTMLElement;
const view = () => EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!;

function mountCode(initial: string, props: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  const source = ref(initial);
  const Host = defineComponent({ setup: () => () => h(CodeField, { label: "Template", ...props, modelValue: source.value, "onUpdate:modelValue": (next: string) => (source.value = next), ...extra }) });
  return { ...render(Host, { global }), source };
}

describe("CodeField", () => {
  it("shows the value and writes typed changes back", async () => {
    const { source } = mountCode("<p>{{ page.title }}</p>", { language: "liquid" });
    await ready();
    expect(content().textContent).toBe("<p>{{ page.title }}</p>");
    view().dispatch({ changes: { from: 0, insert: "x" }, userEvent: "input.type" });
    expect(source.value).toBe("x<p>{{ page.title }}</p>");
  });

  it("follows a value set from outside without echoing it", async () => {
    const updates: string[] = [];
    const { source } = mountCode("one", {}, { "onUpdate:modelValue": (next: string) => updates.push(next) });
    await ready();
    source.value = "two";
    await waitFor(() => expect(content().textContent).toBe("two"));
    expect(updates).toEqual([]);
  });

  it("is read-only when asked, and in a read-mode form", async () => {
    mountCode("a", { readonly: true });
    await ready();
    expect(view().state.readOnly).toBe(true);
    expect(content().getAttribute("contenteditable")).toBe("false");
    expect(document.body.textContent).not.toContain("Esc, then Tab");
    document.body.innerHTML = "";
    mountCode("a", { editable: false });
    await ready();
    expect(view().state.readOnly).toBe(true);
  });

  it("marks the lines the linter named, with their messages", async () => {
    const markers: CodeMarker[] = [
      { line: 2, column: 4, severity: "error", message: "unknown filter" },
      { line: 3, severity: "warning", message: "for without limit" },
    ];
    mountCode("a\nb {{ x | nope }}\nc", { markers, language: "liquid" });
    await ready();
    const { forEachDiagnostic } = await import("@codemirror/lint");
    const found: { line: number; severity: string; message: string }[] = [];
    forEachDiagnostic(view().state, (d, from) => found.push({ line: view().state.doc.lineAt(from).number, severity: d.severity, message: d.message }));
    expect(found).toEqual([{ line: 2, severity: "error", message: "unknown filter" }, { line: 3, severity: "warning", message: "for without limit" }]);
    await waitFor(() => expect(document.querySelectorAll(".cm-lintRange").length).toBeGreaterThan(0));
  });

  it("emits save on Ctrl+S, and Tab indents until Esc hands it back to the browser", async () => {
    let saved = 0;
    mountCode("a", {}, { onSave: () => saved++ });
    await ready();
    const key = (init: KeyboardEventInit) => { const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }); content().dispatchEvent(event); return event; };
    expect(key({ key: "s", ctrlKey: true }).defaultPrevented).toBe(true);
    expect(saved).toBe(1);
    view().dispatch({ selection: { anchor: 0 } });
    expect(key({ key: "Tab" }).defaultPrevented).toBe(true);
    expect(view().state.doc.toString()).toMatch(/^\s+a$/);
    key({ key: "Escape" });
    expect(key({ key: "Tab" }).defaultPrevented).toBe(false);
  });

  it("offers the preview beside the editor, behind a button on narrow screens", async () => {
    const { getByRole, queryByText } = render(defineComponent({ setup: () => () => h(CodeField, { label: "Template", modelValue: "" }, { preview: () => h("p", "page") }) }), { global });
    await ready();
    const button = getByRole("button", { name: "Show preview" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await fireEvent.click(button);
    expect(getByRole("button", { name: "Hide preview" }).getAttribute("aria-expanded")).toBe("true");
    expect(queryByText("page")).not.toBeNull();
  });

  it("works with useForm: dirty after typing, the 422 message under the editor", async () => {
    let form!: ReturnType<typeof useForm<{ body: string }>>;
    render(defineComponent({ setup() { form = useForm({ defaults: () => ({ body: "a" }) }); return () => h(CodeField, { label: "Template", ...form.bind("body") }); } }), { global });
    await ready();
    expect(form.dirty.value).toBe(false);
    view().dispatch({ changes: { from: 1, insert: "b" }, userEvent: "input.type" });
    expect(form.values.body).toBe("ab");
    expect(form.dirty.value).toBe(true);
    form.errors.set({ body: ["Unknown filter"] });
    await waitFor(() => expect(document.body.textContent).toContain("Unknown filter"));
  });

  it("is loaded lazily: no source file imports CodeMirror except through import()", () => {
    for (const file of ["CodeField.vue", "index.ts", "codeEditor.ts"]) {
      const code = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(code.match(/^\s*import (?!type\b)[^;]*from\s+["']@codemirror\//gm) ?? [], file).toEqual([]);
    }
  });
});
