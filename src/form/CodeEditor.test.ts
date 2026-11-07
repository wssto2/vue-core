import { EditorView } from "@codemirror/view";
import { fireEvent, render, waitFor } from "@testing-library/vue";
import { defineComponent, h, ref } from "vue";
import { describe, expect, it } from "vitest";
import { createTestI18n } from "../testing/i18n";
import CodeEditor from "./CodeEditor.vue";

const global = { plugins: [createTestI18n()] };
const ready = () => waitFor(() => expect(document.querySelector(".cm-content")).not.toBeNull(), { timeout: 10_000 });
const content = () => document.querySelector(".cm-content") as HTMLElement;
const view = () => EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!;

type Handle = { reveal: (line: number, column?: number) => void; focus: () => void };
function mountEditor(props: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  const editor = ref<Handle | null>(null);
  const source = ref((props.modelValue as string) ?? "");
  const Host = defineComponent({ setup: () => () => h(CodeEditor, { ref: editor, label: "Template", ...props, modelValue: source.value, "onUpdate:modelValue": (next: string) => (source.value = next), ...extra }) });
  return { ...render(Host, { global }), editor, source };
}

describe("CodeEditor", () => {
  it("is the editor alone: no label, no field row, v-model both ways", async () => {
    const { source, container } = mountEditor({ modelValue: "a\nb" });
    await ready();
    expect(container.querySelector("label")).toBeNull();
    view().dispatch({ changes: { from: 0, insert: "x" }, userEvent: "input.type" });
    expect(source.value).toBe("xa\nb");
    expect(content().getAttribute("aria-label")).toBe("Template");
  });

  it("fill takes the parent's height; otherwise height", async () => {
    const { container, unmount } = mountEditor({ fill: true });
    await ready();
    expect(container.querySelector<HTMLElement>("[data-code-editor]")!.className).toContain("h-full");
    unmount();
    document.body.innerHTML = "";
    const second = mountEditor({ height: "10rem" });
    await ready();
    expect(second.container.querySelector<HTMLElement>("[data-code-editor]")!.style.height).toBe("10rem");
  });

  it("reveal puts the cursor on the line and column, and a cursor event says where it is", async () => {
    const cursors: { line: number; column: number }[] = [];
    const { editor } = mountEditor({ modelValue: "one\ntwo words\nthree" }, { onCursor: (at: { line: number; column: number }) => cursors.push(at) });
    await ready();
    editor.value!.reveal(2, 5);
    expect(view().state.selection.main.head).toBe("one\n".length + 4);
    expect(cursors.at(-1)).toEqual({ line: 2, column: 5 });
    // happy-dom fires selectionchange synchronously, which a focused CodeMirror cannot take inside its own update; a browser does not.
    view().contentDOM.blur();
    editor.value!.reveal(99); // beyond the end: the last line
    expect(cursors.at(-1)).toEqual({ line: 3, column: 1 });
    view().contentDOM.blur();
    view().dispatch({ selection: { anchor: 2 } });
    expect(cursors.at(-1)).toEqual({ line: 1, column: 3 });
  });

  it("carries out a reveal asked for while it is still loading", async () => {
    const cursors: { line: number; column: number }[] = [];
    const { editor } = mountEditor({ modelValue: "a\nb\nc" }, { onCursor: (at: { line: number; column: number }) => cursors.push(at) });
    editor.value!.reveal(3);
    await ready();
    await waitFor(() => expect(cursors.at(-1)).toEqual({ line: 3, column: 1 }));
  });

  it("emits save on Ctrl+S (Mod-s: Cmd+S on a Mac), and stays read-only when asked", async () => {
    let saved = 0;
    mountEditor({ modelValue: "a", readonly: true }, { onSave: () => saved++ });
    await ready();
    const key = (init: KeyboardEventInit) => { const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }); content().dispatchEvent(event); return event; };
    expect(key({ key: "s", ctrlKey: true }).defaultPrevented).toBe(true);
    expect(saved).toBe(1);
    expect(view().state.readOnly).toBe(true);
  });

  it("draws markers in the gutter and underlines them", async () => {
    mountEditor({ modelValue: "a\nb {{ x | nope }}", language: "liquid", markers: [{ line: 2, column: 4, severity: "error", message: "unknown filter" }] });
    await ready();
    await waitFor(() => expect(document.querySelectorAll(".cm-lintRange-error").length).toBeGreaterThan(0));
  });

  it("focuses on request", async () => {
    const { editor } = mountEditor({ modelValue: "a" });
    await ready();
    editor.value!.focus();
    expect(view().hasFocus).toBe(true);
    await fireEvent.blur(content());
  });
});
