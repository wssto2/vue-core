import { fireEvent, render, screen, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { createTestI18n, mockMedia, testFormatting } from "../testing";
import CollectionTable from "./CollectionTable.vue";
import type { CollectionColumns } from "./columns";
import { defineCollection } from "./definition";
import { listPage } from "../testing/collection";
import { deferred, fakeLoader, flush } from "./testing";
import { useCollection } from "./useCollection";

interface Person {
  readonly id: number;
  readonly name: string;
}

const PEOPLE: Person[] = [
  { id: 1, name: "Ana Horvat" },
  { id: 2, name: "Ivo Kovač" },
  { id: 3, name: "Iva Babić" },
];

const columns = [
  { key: "name", label: "Name", kind: "identity", mobile: "primary" },
  { key: "id", label: "", kind: "custom", mobile: "accessory" },
] satisfies CollectionColumns<Person>;

const i18n = createTestI18n();
let restore: () => void = () => undefined;
afterEach(() => {
  restore();
  restore = () => undefined;
  document.body.innerHTML = "";
  vi.useRealTimers();
});

async function mountPicker(options: { narrow?: boolean; pick?: boolean; loader?: ReturnType<typeof fakeLoader<Person>>; button?: boolean } = {}) {
  restore = mockMedia({ narrow: options.narrow ?? false }).restore;
  const loader = options.loader ?? fakeLoader<Person>((query) => listPage(PEOPLE.filter((person) => person.name.toLowerCase().includes(query.search.toLowerCase()))));
  const definition = defineCollection({ id: "people", stateVersion: 1, load: loader.load as never, key: (person: Person) => person.id, query: { sorts: [], filters: [] } });
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/", component: { render: () => h("div") } }] });
  await router.push("/");
  await router.isReady();
  const picked: Person[] = [];
  const Host = defineComponent({
    setup() {
      const people = useCollection(definition as never, { columns: columns as never, state: { kind: "memory" } }) as never;
      return () =>
        h(CollectionTable as never, { collection: people, pick: options.pick === false ? undefined : (person: Person) => picked.push(person) } as never, {
          "cell-id": ({ item }: { item: Person }) => (options.button ? h("button", { type: "button", "data-test": "own-button" }, `Assign ${item.id}`) : null),
        });
    },
  });
  render(Host, { global: { plugins: [router, i18n, testFormatting(i18n)] } });
  await flush();
  return { picked, loader };
}

const options = () => [...document.querySelectorAll<HTMLElement>("[role='option']")];
const listbox = () => screen.getByRole("listbox", { name: "Choose one" });
const search = () => screen.getByRole("textbox", { name: "Search" });

/** Whether the key was left alone (not default-prevented); testing-library's fireEvent does not say. */
const press = (element: Element, key: string) => element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

async function type(text: string) {
  vi.useFakeTimers();
  await fireEvent.update(search(), text);
  vi.advanceTimersByTime(400);
  vi.useRealTimers();
  await flush();
}

describe.each([{ narrow: false }, { narrow: true }])("a picker (narrow: $narrow)", ({ narrow }) => {
  it("is a listbox of options, named, and its rows are not links", async () => {
    await mountPicker({ narrow });
    expect(options()).toHaveLength(3);
    expect(listbox().getAttribute("tabindex")).toBe("0");
    expect(within(listbox()).queryAllByRole("link")).toHaveLength(0);
    expect(options()[0]!.className).toContain("cursor-pointer");
  });

  it("a click on the row picks it, a click on a button inside it does not", async () => {
    const { picked } = await mountPicker({ narrow, button: true });
    await fireEvent.click(within(options()[1]!).getByRole("button"));
    expect(picked).toEqual([]);
    await fireEvent.click(options()[1]!);
    expect(picked).toEqual([PEOPLE[1]]);
  });

  it("the arrows move the current row and Enter picks it", async () => {
    const { picked } = await mountPicker({ narrow });
    const list = listbox();
    await fireEvent.focus(list);
    expect(list.getAttribute("aria-activedescendant")).toBe(options()[0]!.id);
    await fireEvent.keyDown(list, { key: "ArrowDown" });
    await fireEvent.keyDown(list, { key: "ArrowDown" });
    await fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(list.getAttribute("aria-activedescendant")).toBe(options()[2]!.id);
    expect(options()[2]!.hasAttribute("data-current")).toBe(true);
    await fireEvent.keyDown(list, { key: "ArrowUp" });
    expect(list.getAttribute("aria-activedescendant")).toBe(options()[1]!.id);
    await fireEvent.keyDown(list, { key: "Home" });
    expect(list.getAttribute("aria-activedescendant")).toBe(options()[0]!.id);
    await fireEvent.keyDown(list, { key: "End" });
    await fireEvent.keyDown(list, { key: "Enter" });
    expect(picked).toEqual([PEOPLE[2]]);
  });

  it("Down in the search field moves into the rows; Escape is left to the container", async () => {
    await mountPicker({ narrow });
    const reached = vi.fn();
    document.addEventListener("keydown", (event) => event.key === "Escape" && reached(event.defaultPrevented));
    search().focus();
    expect(press(search(), "ArrowDown")).toBe(false);
    await nextTick();
    expect(document.activeElement).toBe(listbox());
    expect(listbox().getAttribute("aria-activedescendant")).toBe(options()[0]!.id);
    expect(press(listbox(), "Escape")).toBe(true);
    expect(press(search(), "Escape")).toBe(true);
    expect(reached.mock.calls).toEqual([[false], [false]]);
  });

  it("Enter in the search field picks the only row", async () => {
    const { picked } = await mountPicker({ narrow });
    await type("ana");
    expect(options()).toHaveLength(1);
    await fireEvent.keyDown(search(), { key: "Enter" });
    expect(picked).toEqual([PEOPLE[0]]);
  });

  it("Enter in the search field does nothing with no row, with several, before the search lands, or while it loads", async () => {
    const { picked } = await mountPicker({ narrow });
    await fireEvent.keyDown(search(), { key: "Enter" });
    await type("iv");
    await type("ivo");
    expect(options()).toHaveLength(1);
    await type("zzz");
    await fireEvent.keyDown(search(), { key: "Enter" });
    expect(options()).toHaveLength(0);
    await type("");
    await fireEvent.keyDown(search(), { key: "Enter" });
    expect(picked).toEqual([]);

    // Typed but not yet searched: the one row on screen is not what the field says.
    await type("ana");
    vi.useFakeTimers();
    await fireEvent.update(search(), "ivo");
    await fireEvent.keyDown(search(), { key: "Enter" });
    vi.useRealTimers();
    expect(picked).toEqual([]);
  });

  it("Enter does nothing while the rows are loading", async () => {
    const gate = deferred<ReturnType<typeof listPage<Person>>>();
    let calls = 0;
    const loader = fakeLoader<Person>(() => (++calls === 1 ? listPage([PEOPLE[0]!]) : gate.promise));
    const { picked } = await mountPicker({ narrow, loader });
    await type("ana");
    await fireEvent.keyDown(search(), { key: "Enter" });
    expect(picked).toEqual([]);
    gate.resolve(listPage([PEOPLE[0]!]));
    await flush();
    await nextTick();
  });
});

describe("without pick mode", () => {
  it("is a table of rows as before", async () => {
    const { picked } = await mountPicker({ pick: false });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(options()).toHaveLength(0);
    expect(screen.getAllByRole("row")).toHaveLength(4);
    await fireEvent.click(screen.getAllByRole("row")[1]!);
    await fireEvent.keyDown(search(), { key: "Enter" });
    expect(picked).toEqual([]);
  });
});
