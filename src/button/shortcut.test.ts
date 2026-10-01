import { render } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { shortcutKeys, useKeyboardShortcut, useShortcutRegistry, type KeyboardShortcut } from "./shortcut";

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
