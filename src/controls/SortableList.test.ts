import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { createTestI18n } from "../testing/i18n";
import SortableList from "./SortableList.vue";

const global = { plugins: [createTestI18n()] };
type Row = { id: string; name: string };
const rows = (): Row[] => [{ id: "a", name: "Hero" }, { id: "b", name: "Text" }, { id: "c", name: "Gallery" }];

function mount(props: Record<string, unknown> = {}) {
  const items = ref(rows());
  const Host = defineComponent({
    setup: () => () =>
      h(SortableList<Row>, { modelValue: items.value, "onUpdate:modelValue": (next: Row[]) => (items.value = next), itemKey: "id", itemLabel: (row: Row) => row.name, label: "Components", ...props }, {
        item: ({ item }: { item: Row }) => h("span", item.name),
      }),
  });
  return { ...render(Host, { global }), items };
}
const order = (items: Row[]) => items.map((row) => row.id).join("");
const live = () => document.querySelector("[data-sortable-live]")!.textContent;

afterEach(() => (document.body.innerHTML = ""));

describe("SortableList", () => {
  it("lists the items with a labelled handle each", () => {
    mount();
    expect(screen.getByRole("list", { name: "Components" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Move Hero" })).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("Alt+ArrowDown moves the item down and says where it went", async () => {
    const { items } = mount();
    await fireEvent.keyDown(screen.getByRole("button", { name: "Move Hero" }), { key: "ArrowDown", altKey: true });
    expect(order(items.value)).toBe("bac");
    expect(live()).toBe("Hero moved to position 2 of 3");
  });

  it("Alt+ArrowUp moves up; the first item cannot go further and says nothing", async () => {
    const { items } = mount();
    await fireEvent.keyDown(screen.getByRole("button", { name: "Move Gallery" }), { key: "ArrowUp", altKey: true });
    expect(order(items.value)).toBe("acb");
    expect(live()).toBe("Gallery moved to position 2 of 3");
    await fireEvent.keyDown(screen.getByRole("button", { name: "Move Hero" }), { key: "ArrowUp", altKey: true });
    expect(order(items.value)).toBe("acb");
    expect(live()).toBe("Gallery moved to position 2 of 3");
  });

  it("an arrow without Alt does nothing (the page still scrolls)", async () => {
    const { items } = mount();
    await fireEvent.keyDown(screen.getByRole("button", { name: "Move Hero" }), { key: "ArrowDown" });
    expect(order(items.value)).toBe("abc");
  });

  it("keeps focus on the moved item's handle", async () => {
    mount();
    const handle = screen.getByRole("button", { name: "Move Hero" });
    handle.focus();
    await fireEvent.keyDown(handle, { key: "ArrowDown", altKey: true });
    await nextTick();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Move Hero" }));
  });

  it("has no handles when disabled", () => {
    mount({ disabled: true });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("describes the shortcut to screen readers", () => {
    mount();
    const handle = screen.getByRole("button", { name: "Move Hero" });
    expect(document.getElementById(handle.getAttribute("aria-describedby")!)!.textContent).toContain("Alt");
  });
});
