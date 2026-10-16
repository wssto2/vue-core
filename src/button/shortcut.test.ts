import { render } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, onMounted, ref } from "vue";
import { useDialogStack } from "../overlay/dialogStack";
import { matchesShortcut, shortcutKeys, useKeyboardShortcut, useShortcutRegistry, type KeyboardShortcut } from "./shortcut";

const Owner = (shortcut: () => KeyboardShortcut | undefined) =>
  defineComponent({ setup() { useKeyboardShortcut(shortcut, () => undefined); return () => h("p"); } });

describe("shortcut registry", () => {
  it("lists labelled shortcuts while their owner is mounted, and not the unlabelled ones", async () => {
    const rows = useShortcutRegistry();
    const before = rows.value.length;
    const view = render(Owner(() => ({ key: "/", group: "list", label: "Search" })));
    render(Owner(() => ({ key: "x" })));
    await nextTick();
    expect(rows.value.slice(before)).toEqual([{ group: "list", label: "Search", keys: [["/"]] }]);
    view.unmount();
    expect(rows.value.length).toBe(before);
  });

  it("merges rows with the same group and label: alternative keys, and the same key twice once", () => {
    const rows = useShortcutRegistry();
    const before = rows.value.length;
    render(Owner(() => ({ key: "j", group: "record", label: "Next" })));
    render(Owner(() => ({ key: "ArrowRight", group: "record", label: "Next" })));
    render(Owner(() => ({ key: "j", group: "record", label: "Next" })));
    expect(rows.value.slice(before)).toEqual([{ group: "record", label: "Next", keys: [["J"], ["→"]] }]);
  });

  it("reads a label function when the list is read, so it follows the locale, and skips an empty one", async () => {
    const rows = useShortcutRegistry();
    const word = ref("Open filters");
    render(Owner(() => ({ key: "f", group: "list", label: () => word.value })));
    expect(rows.value.some((row) => row.label === "Open filters")).toBe(true);
    word.value = "Otvori filtere";
    expect(rows.value.some((row) => row.label === "Otvori filtere")).toBe(true);
    word.value = "";
    expect(rows.value.some((row) => row.group === "list" && row.keys[0]?.[0] === "F")).toBe(false);
  });

  it("follows a shortcut that changes, without looping", async () => {
    const rows = useShortcutRegistry();
    const key = ref("a");
    render(Owner(() => ({ key: key.value, label: "Mine" })));
    expect(rows.value.find((row) => row.label === "Mine")?.keys).toEqual([["A"]]);
    key.value = "b";
    await nextTick();
    expect(rows.value.find((row) => row.label === "Mine")?.keys).toEqual([["B"]]);
  });
});

describe("shortcutKeys", () => {
  it("writes modifiers before the key and arrows as arrows", () => {
    expect(shortcutKeys({ key: "ArrowLeft" })).toEqual(["←"]);
    const keys = shortcutKeys({ key: "s", ctrlKey: true, shiftKey: true });
    expect(keys.at(-1)).toBe("S");
    expect(keys).toHaveLength(3);
  });
});

const press = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);

describe("matchesShortcut: Shift", () => {
  it("fires a symbol key whatever the Shift state, as on a layout where the symbol needs Shift", () => {
    expect(matchesShortcut(press({ key: "/", shiftKey: true, code: "Digit7" }), { key: "/" })).toBe(true);
    expect(matchesShortcut(press({ key: "/", code: "Slash" }), { key: "/" })).toBe(true);
    expect(matchesShortcut(press({ key: "?", shiftKey: true }), { key: "?" })).toBe(true);
    expect(matchesShortcut(press({ key: "?" }), { key: "?" })).toBe(true);
  });

  it("still requires the other modifiers exactly, and Shift when the shortcut sets it", () => {
    expect(matchesShortcut(press({ key: "/", shiftKey: true, ctrlKey: true }), { key: "/" })).toBe(false);
    expect(matchesShortcut(press({ key: "?" }), { key: "?", shiftKey: true })).toBe(false);
    expect(matchesShortcut(press({ key: "?", shiftKey: true }), { key: "?", shiftKey: true })).toBe(true);
  });

  it("keeps exact Shift for letters, digits and named keys", () => {
    expect(matchesShortcut(press({ key: "J", shiftKey: true }), { key: "j" })).toBe(false);
    expect(matchesShortcut(press({ key: "j" }), { key: "j" })).toBe(true);
    expect(matchesShortcut(press({ key: "ArrowRight", shiftKey: true }), { key: "ArrowRight" })).toBe(false);
    expect(matchesShortcut(press({ key: "7", shiftKey: true }), { key: "7" })).toBe(false);
  });
});

describe("mod", () => {
  const platform = (value: string) => vi.spyOn(navigator, "platform", "get").mockReturnValue(value);
  afterEach(() => vi.restoreAllMocks());

  it("matches Ctrl or Meta alone, on every platform", () => {
    const k = { key: "k", mod: true };
    expect(matchesShortcut(press({ key: "k", ctrlKey: true }), k)).toBe(true);
    expect(matchesShortcut(press({ key: "k", metaKey: true }), k)).toBe(true);
    expect(matchesShortcut(press({ key: "k" }), k)).toBe(false);
    expect(matchesShortcut(press({ key: "k", ctrlKey: true, metaKey: true }), k)).toBe(false);
    expect(matchesShortcut(press({ key: "k", ctrlKey: true, altKey: true }), k)).toBe(false);
    expect(matchesShortcut(press({ key: "k", ctrlKey: true, shiftKey: true }), k)).toBe(false);
    expect(matchesShortcut(press({ key: "k", ctrlKey: true, shiftKey: true }), { ...k, shiftKey: true })).toBe(true);
  });

  it("is listed as ⌘ on Apple platforms and Ctrl elsewhere", () => {
    platform("MacIntel");
    expect(shortcutKeys({ key: "k", mod: true })).toEqual(["⌘", "K"]);
    platform("Win32");
    expect(shortcutKeys({ key: "k", mod: true })).toEqual(["Ctrl", "K"]);
  });

  it("fires inside a field, like any shortcut with a modifier", () => {
    const run = vi.fn();
    render(defineComponent({ setup() { useKeyboardShortcut({ key: "k", mod: true }, run); return () => h("input", { "data-testid": "field" }); } }));
    document.querySelector("input")!.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
    expect(run).toHaveBeenCalledOnce();
  });
});

describe("shortcuts and an open dialog", () => {
  const press = (key: string) => window.dispatchEvent(new KeyboardEvent("keydown", { key }));
  const Counter = (key: string, spy: () => void) =>
    defineComponent({ setup() { useKeyboardShortcut({ key }, () => spy()); return () => h("span"); } });

  it("keeps the page's shortcuts off while a dialog is open, and the dialog's own ones on", async () => {
    const page = vi.fn();
    const inside = vi.fn();
    const Inside = Counter("x", inside);
    const Dialog = defineComponent({
      setup() {
        const root = ref<HTMLElement | null>(null);
        const { activate } = useDialogStack(root);
        onMounted(activate);
        return () => h("div", { ref: root, role: "dialog", "aria-modal": "true" }, [h(Inside)]);
      },
    });

    render(Counter("?", page));
    press("?");
    expect(page).toHaveBeenCalledTimes(1);

    const dialog = render(Dialog);
    await nextTick();
    press("?");
    press("x");
    expect(page).toHaveBeenCalledTimes(1);
    expect(inside).toHaveBeenCalledTimes(1);

    dialog.unmount();
    press("?");
    expect(page).toHaveBeenCalledTimes(2);
  });
});
