import { fireEvent, render, screen, within } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, ref } from "vue";
import { createTestI18n } from "../testing";
import CollectionTree from "./CollectionTree.vue";
import type { TreeColumn, TreeNode, TreeReorder } from "./tree";
import { matchesText, visibleNodes } from "./tree";

interface Item extends TreeNode<Item> {
  readonly code?: string;
}
const TREE: Item[] = [
  { id: "news", label: "Novosti", children: [{ id: "n1", label: "Akcije" }] },
  {
    id: "basic", label: "Osnovno", children: [
      { id: "brands", label: "Marke", active: true, children: [
        { id: "renault", label: "Renault", code: "renault", active: true },
        { id: "dacia", label: "Dacia", code: "dacia", active: true },
        { id: "skoda", label: "Škoda", code: "skoda", active: false },
      ] },
      { id: "countries", label: "Države", active: true, children: [{ id: "hr", label: "Hrvatska", active: true }, { id: "si", label: "Slovenija", active: true }] },
    ],
  },
];
// "Kod marke" belongs to the items of Marke only.
const columns: TreeColumn<Item>[] = [{ key: "code", label: "Kod marke", visible: (node) => node.id === "renault" || node.id === "dacia" || node.id === "skoda" }];
const i18n = createTestI18n();

afterEach(() => (document.body.innerHTML = ""));

function mount(props: Record<string, unknown> = {}, initial: (string | number)[] = []) {
  const expanded = ref<(string | number)[]>(initial);
  const events = { reorder: [] as TreeReorder[], add: [] as (string | number | null)[], toggle: [] as [string | number, boolean][], open: [] as (string | number)[] };
  const Host = defineComponent({
    setup: () => () =>
      h(CollectionTree as never, {
        nodes: TREE, columns, label: "Karakteristike", reorderable: true, activeLabel: "Aktivna", expanded: expanded.value,
        addLabel: (parent: Item | null, level: number) => (parent === null ? null : `Dodaj ${level}`),
        "onUpdate:expanded": (next: (string | number)[]) => (expanded.value = next),
        onReorder: (change: TreeReorder) => events.reorder.push(change),
        onAdd: (parent: Item | null) => events.add.push(parent?.id ?? null),
        onToggle: (node: Item, active: boolean) => events.toggle.push([node.id, active]),
        onOpen: (node: Item) => events.open.push(node.id),
        ...props,
      } as never),
  });
  return { ...render(Host, { global: { plugins: [i18n] } }), expanded, events };
}
const names = () => [...document.querySelectorAll("[data-test=tree-node] > .tree-row button.truncate")].map((button) => button.textContent?.trim());

describe("CollectionTree", () => {
  it("shows the roots closed, with a count, and opens a group with its chevron (aria-expanded) and v-model:expanded", async () => {
    const { expanded } = mount();
    expect(names()).toEqual(["Novosti", "Osnovno"]);
    expect(document.querySelectorAll("[data-test=tree-count]")[0]!.textContent).toBe("1");
    const chevron = screen.getByRole("button", { name: "Expand Osnovno" });
    expect(chevron.getAttribute("aria-expanded")).toBe("false");
    await fireEvent.click(chevron);
    expect(expanded.value).toEqual(["basic"]);
    expect(screen.getByRole("button", { name: "Collapse Osnovno" }).getAttribute("aria-expanded")).toBe("true");
    expect(names()).toEqual(["Novosti", "Osnovno", "Marke", "Države"]);
    await fireEvent.click(screen.getByRole("button", { name: "Collapse Osnovno" }));
    expect(expanded.value).toEqual([]);
    expect(names()).toEqual(["Novosti", "Osnovno"]);
  });

  it("indents by level: each branch is nested inside its parent's row", () => {
    mount({}, ["basic", "brands"]);
    const depth = (name: string) => Number([...document.querySelectorAll("[data-test=tree-node]")].find((node) => node.querySelector(":scope > .tree-row button.truncate")?.textContent?.trim() === name)?.getAttribute("data-depth"));
    expect([depth("Osnovno"), depth("Marke"), depth("Renault")]).toEqual([0, 1, 2]);
  });

  it("reorders within a parent with Alt+Arrow and reports { id, parentId, index }", async () => {
    const { events } = mount({}, ["basic", "brands"]);
    await fireEvent.keyDown(screen.getByRole("button", { name: "Move Renault" }), { key: "ArrowDown", altKey: true });
    expect(events.reorder).toEqual([{ id: "renault", parentId: "brands", index: 1 }]);
    await fireEvent.keyDown(screen.getByRole("button", { name: "Move Marke" }), { key: "ArrowDown", altKey: true });
    expect(events.reorder[1]).toEqual({ id: "brands", parentId: "basic", index: 1 });
    await fireEvent.keyDown(screen.getByRole("button", { name: "Move Osnovno" }), { key: "ArrowUp", altKey: true });
    expect(events.reorder[2]).toEqual({ id: "basic", parentId: null, index: 0 });
  });

  it("never moves a row out of its parent: the first child cannot go up, the last cannot go down", async () => {
    const { events } = mount({}, ["basic", "brands"]);
    await fireEvent.keyDown(screen.getByRole("button", { name: "Move Renault" }), { key: "ArrowUp", altKey: true });
    await fireEvent.keyDown(screen.getByRole("button", { name: "Move Škoda" }), { key: "ArrowDown", altKey: true });
    expect(events.reorder).toEqual([]);
  });

  it("has no handles when it is not reorderable or is readonly (but keeps the layout)", () => {
    mount({ reorderable: false }, ["basic"]);
    expect(screen.queryAllByRole("button", { name: /^Move / })).toHaveLength(0);
    document.body.innerHTML = "";
    mount({ readonly: true }, ["basic"]);
    expect(screen.queryAllByRole("button", { name: /^Move / })).toHaveLength(0);
    expect(document.querySelector("[data-test=tree-add-row]")).toBeNull();
    expect((screen.getAllByRole("switch")[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it("a search keeps the ancestors of the matches, open, and marks the text", async () => {
    mount({ search: "skoda" });
    expect(names()).toEqual(["Osnovno", "Marke", "Škoda"]); // accents and case ignored; Novosti and Države are gone
    expect(screen.getByRole("button", { name: "Collapse Osnovno" }).getAttribute("aria-expanded")).toBe("true"); // held open by the search
    document.body.innerHTML = "";
    mount({ search: "ŠKOD" });
    expect(document.querySelector("mark")?.textContent).toBe("Škod");
  });

  it("turns reordering off while a search hides rows", async () => {
    mount({ search: "a" }, []);
    expect(screen.queryAllByRole("button", { name: /^Move / })).toHaveLength(0);
  });

  it("a filter keeps the ancestors of what it lets through", () => {
    mount({ filter: (node: Item) => node.active === false });
    expect(names()).toEqual(["Osnovno", "Marke", "Škoda"]);
  });

  it("shows a column only on the rows it belongs to (a branch's own column), blank elsewhere", () => {
    mount({}, ["basic", "brands"]);
    expect(screen.getAllByText("Kod marke")).toHaveLength(1); // the header
    const cellOf = (name: string) => [...document.querySelectorAll("[data-test=tree-node]")].find((node) => node.querySelector(":scope > .tree-row button.truncate")?.textContent?.trim() === name)!.querySelector(":scope > .tree-row [aria-label='Kod marke']")!;
    expect(cellOf("Renault").textContent?.trim()).toBe("renault");
    expect(cellOf("Marke").textContent?.trim()).toBe("");
    expect(cellOf("Osnovno").textContent?.trim()).toBe("");
  });

  it("draws a cell from its slot", () => {
    mount({}, ["basic", "brands"]);
    document.body.innerHTML = "";
    const Host = defineComponent({ setup: () => () => h(CollectionTree as never, { nodes: TREE, columns, label: "T", expanded: ["basic", "brands"] } as never, { "cell-code": ({ node }: { node: Item }) => h("code", `#${node.code}`) }) });
    render(Host, { global: { plugins: [i18n] } });
    expect(screen.getByText("#renault").tagName).toBe("CODE");
  });

  it("flips the active switch with @toggle", async () => {
    const { events } = mount({}, ["basic", "brands"]);
    await fireEvent.click(screen.getByRole("switch", { name: "Aktivna: Škoda" }));
    await fireEvent.click(screen.getByRole("switch", { name: "Aktivna: Dacia" }));
    expect(events.toggle).toEqual([["skoda", true], ["dacia", false]]);
    expect(screen.getByRole("switch", { name: "Aktivna: Škoda" }).getAttribute("aria-checked")).toBe("false");
  });

  it("offers an add button per level with the app's label: at the end of a branch's items, on a closed or empty row, never for null", async () => {
    const { events } = mount({}, ["basic", "brands"]);
    const buttons = [...document.querySelectorAll("[data-test=tree-add-footer]")].map((button) => button.textContent?.trim());
    expect(buttons).toEqual(["Dodaj 3", "Dodaj 2"]); // under Marke (items, level 3) and under Osnovno (level 2)
    await fireEvent.click(document.querySelectorAll("[data-test=tree-add-footer]")[0]!);
    expect(events.add).toEqual(["brands"]);
    const row = within(document.querySelectorAll("[data-test=tree-node]")[0] as HTMLElement).getByRole("button", { name: "Dodaj 2" }); // Novosti is closed: its pill
    await fireEvent.click(row);
    expect(events.add).toEqual(["brands", "news"]);
  });

  it("adds a root through addLabel(null)", async () => {
    const { events } = mount({ addLabel: (parent: Item | null) => (parent === null ? "Dodaj skupinu" : null) });
    await fireEvent.click(screen.getByRole("button", { name: "Dodaj skupinu" }));
    expect(events.add).toEqual([null]);
  });

  it("opens a row from its name, and lists its actions in a labelled More menu", async () => {
    const { events } = mount({ rowActions: (node: Item) => [{ key: "x", label: `Akcija ${node.label}`, icon: "edit", onSelect: () => undefined }] });
    await fireEvent.click(screen.getByRole("button", { name: "Osnovno" }));
    expect(events.open).toEqual(["basic"]);
    await fireEvent.click(screen.getByRole("button", { name: "More actions: Osnovno" }));
    expect(await screen.findByRole("menuitem", { name: "Akcija Osnovno" })).toBeTruthy();
  });

  it("says when nothing matches", () => {
    mount({ search: "zzz" });
    expect(document.querySelector("[data-test=tree-empty]")?.textContent).toContain("No rows match.");
  });
});

describe("visibleNodes and matchesText", () => {
  it("returns the matches and their ancestors, and which ancestors to open", () => {
    const { shown, forced } = visibleNodes(TREE, (node) => node.id === "dacia");
    expect([...shown].sort()).toEqual(["basic", "brands", "dacia"]);
    expect([...forced].sort()).toEqual(["basic", "brands"]);
  });

  it("matches ignoring case and accents", () => {
    expect(matchesText("Škoda", "SKODA")).toBe(true);
    expect(matchesText("Škoda", "dacia")).toBe(false);
  });
});
