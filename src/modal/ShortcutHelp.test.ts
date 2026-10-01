import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { useKeyboardShortcut } from "../button";
import { createTestI18n } from "../testing/i18n";
import ShortcutHelp from "./ShortcutHelp.vue";

const page = defineComponent({
  setup() {
    useKeyboardShortcut({ key: "/", group: "list", label: "Search the list" }, () => undefined);
    useKeyboardShortcut({ key: "g", group: "tickets", label: "Go to ticket" }, () => undefined);
    return () => h(ShortcutHelp);
  },
});

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
});

describe("ShortcutHelp", () => {
  it("opens on ? and lists the page's shortcuts under their groups, itself included", async () => {
    render(page, { global: { plugins: [createTestI18n("en")], stubs: { transition: false } } });
    expect(screen.queryByText("Keyboard shortcuts")).toBeNull();
    await fireEvent.keyDown(document.body, { key: "?", shiftKey: true });
    await nextTick();
    await nextTick();
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Keyboard shortcuts");
    for (const text of ["List", "Search the list", "Show shortcuts", "General", "tickets", "Go to ticket"]) expect(dialog.textContent).toContain(text);
    expect([...dialog.querySelectorAll("kbd")].map((key) => key.textContent)).toEqual(expect.arrayContaining(["/", "G", "?"]));
  });
});
