import { fireEvent, render, screen, within } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computed, defineComponent, h, nextTick, type PropType } from "vue";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { useShortcutRegistry } from "../button";
import { ApiError } from "../client";
import { createTestI18n } from "../testing/i18n";
import { testFormatting } from "../testing/format";
import type { PageAction } from "../page";
import CollectionPage from "./CollectionPage.vue";
import CollectionTable from "./CollectionTable.vue";
import type { CollectionColumns, RowAction } from "./columns";
import { defineCollection } from "./definition";
import type { FilterDescriptor } from "./filters";
import { createMemorySavedViews } from "./savedViews";
import { fakeLoader, flush, page } from "./testing";
import { useCollection, type Collection } from "./useCollection";

interface Customer {
  readonly id: number;
  readonly first_name: string;
  readonly last_name: string;
  readonly email: string | null;
  readonly city: string | null;
  readonly created_at: string;
  readonly phase: { readonly label: string };
}

const CUSTOMERS: Customer[] = [
  { id: 1, first_name: "Ana", last_name: "Horvat", email: "ana@example.com", city: "Split", created_at: "2026-09-01T10:30:00Z", phase: { label: "Open" } },
  { id: 2, first_name: "Ivo", last_name: "Kovač", email: null, city: null, created_at: "2026-09-02T08:00:00Z", phase: { label: "Closed" } },
];

const i18n = createTestI18n("en");

/** The phone layout: the table switches to rows below 1024 px. */
function viewport(narrow: boolean) {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    media: query,
    matches: narrow && query.includes("max-width: 1023px"),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  return () => (window.matchMedia = original);
}

const columns = [
  { key: "first_name", label: "Name", kind: "identity", title: (c: Customer) => `${c.first_name} ${c.last_name}`, subtitle: (c: Customer) => c.email, mobile: "primary" },
  { key: "city", label: "City", hideBelow: "md", mobile: "meta" },
  { key: "created_at", label: "Created", kind: "timestamp", sort: "created_at", width: 140, mobile: "meta" },
  { key: "phase.label", label: "Phase", kind: "custom", mobile: "accessory" },
] satisfies CollectionColumns<Customer, "created_at" | "first_name">;

type Setup = {
  loader?: ReturnType<typeof fakeLoader>;
  rowActions?: (row: Customer) => RowAction[];
  actionsVisible?: boolean;
  filters?: FilterDescriptor<"phase" | "location">[];
  savedViews?: Parameters<typeof useCollection>[1]["savedViews"];
  pageActions?: PageAction[];
  withSlots?: boolean;
  emptySlot?: boolean;
  blankCity?: boolean;
  record?: boolean;
  state?: "url" | "memory";
  rows?: Customer[];
  lastPage?: number;
};

let restoreViewport: () => void = () => undefined;
beforeEach(() => {
  restoreViewport = viewport(false);
});
afterEach(() => {
  restoreViewport();
  document.body.innerHTML = "";
});

async function mountList(setup: Setup = {}) {
  const loader = setup.loader ?? fakeLoader((query) => page((setup.rows ?? CUSTOMERS) as never, { page: query.page, lastPage: setup.lastPage ?? 1, total: (setup.rows ?? CUSTOMERS).length }) as never);
  const definition = defineCollection({
    id: "customers",
    stateVersion: 1,
    load: loader.load as never,
    key: (customer: Customer) => customer.id,
    query: { sorts: ["created_at", "first_name"], filters: ["phase", "location"], views: ["all", "mine"] },
    defaults: { sort: "created_at", direction: "desc", pageSize: 25 },
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/customers", name: "customers", component: { render: () => h("div") } },
      { path: "/customers/:customerID", name: "customer", component: { render: () => h("div", "record") } },
    ],
  });
  await router.push("/customers");
  await router.isReady();

  let list!: Collection<Customer, "created_at" | "first_name", "phase" | "location", "all" | "mine", (typeof columns)[number]>;
  const Page = defineComponent({
    props: { mode: { type: String as PropType<"page" | "table">, default: "page" } },
    setup(props) {
      list = useCollection(definition as never, {
        columns: computed(() => columns),
        filters: setup.filters ? computed(() => setup.filters ?? []) : undefined,
        views: computed(() => [{ key: "all" as const, label: "All" }, { key: "mine" as const, label: "Mine" }]),
        state: setup.state === "memory" ? { kind: "memory" } : { kind: "url", key: "query" },
        recordRoute: setup.record === false ? undefined : (customer: Customer) => ({ name: "customer", params: { customerID: customer.id } }),
        savedViews: setup.savedViews,
      }) as never;
      return () =>
        h(props.mode === "page" ? CollectionPage : CollectionTable, { collection: list, title: "Customers", rowActions: setup.rowActions, actionsVisible: setup.actionsVisible, rowLabel: (c: Customer) => `${c.first_name} ${c.last_name}`, actions: setup.pageActions } as never, {
          ...(setup.emptySlot ? { empty: () => h("p", { "data-test": "first-use" }, "Add your first customer") } : {}),
          ...(setup.blankCity ? { "cell-city": ({ item }: { item: Customer }) => (item.city ? h("span", item.city) : null) } : {}),
          ...(setup.withSlots
            ? {
                "cell-phase_label": ({ item, compact }: { item: Customer; compact: boolean }) => h("span", { "data-test": "phase" }, `${compact ? "c" : "d"}:${item.phase.label}`),
                leading: ({ item }: { item: Customer }) => h("i", { "data-test": "lead" }, item.first_name[0]),
              }
            : {}),
        });
    },
  });
  const view = render(defineComponent({ render: () => h("div", [h(Page), h(RouterView)]) }), { global: { plugins: [router, i18n, testFormatting(i18n)] } });
  await flush();
  return { ...view, router, list, loader };
}

describe("states", () => {
  it("renders the title, the count, the columns and the rows", async () => {
    await mountList();
    expect(screen.getByRole("heading", { name: "Customers" })).toBeTruthy();
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent?.trim())).toEqual(["Name", "City", "Created", "Phase", "More"]);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByRole("link", { name: "Ana Horvat" }).getAttribute("href")).toMatch(/^\/customers\/1\?from=/);
    expect(within(rows[0]!).getByText("ana@example.com")).toBeTruthy();
    expect(rows[0]!.textContent).toContain("Split");
    expect(rows[0]!.textContent).toContain("Open");
    expect(rows[0]!.querySelector("time")).toBeTruthy();
  });

  it("shows skeleton rows while loading", async () => {
    const never = new Promise<never>(() => undefined);
    await mountList({ loader: fakeLoader(() => never as never) });
    expect(document.querySelectorAll("tbody tr[aria-hidden='true']")).toHaveLength(25);
    expect(document.querySelector("[aria-busy='true']")).toBeTruthy();
  });

  it("a failed load is a failure with a retry, never an empty list", async () => {
    let fail = true;
    const { loader } = await mountList({ loader: fakeLoader(() => (fail ? Promise.reject(new ApiError({ kind: "server", message: "Database is down", status: 500 })) : page(CUSTOMERS as never)) as never) });
    expect(screen.getByText("The list could not be loaded")).toBeTruthy();
    expect(screen.getByText("Database is down")).toBeTruthy();
    expect(screen.queryByText("No data")).toBeNull();
    fail = false;
    await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await flush();
    expect(loader.calls.length).toBe(2);
    expect(screen.getByRole("link", { name: "Ana Horvat" })).toBeTruthy();
  });

  it("an empty list says so; a search or filter that matched nothing lists them with ways out", async () => {
    const { list } = await mountList({ rows: [], filters: [{ key: "phase", label: "Phase", type: "select", options: [{ value: "open", label: "Open" }] }] });
    expect(screen.getByText("No data")).toBeTruthy();
    list.setFilter("phase", "open");
    list.search("ana");
    await flush();
    const empty = document.querySelector("[data-test='collection-empty-filtered']") as HTMLElement;
    expect(empty).toBeTruthy();
    expect(within(empty).getByText("Open")).toBeTruthy();
    expect(within(empty).getByText("ana")).toBeTruthy();
    await fireEvent.click(screen.getByText("Remove: ana")); // the most recently changed
    await flush();
    expect(list.query.value.search).toBe("");
    expect(list.query.value.filters).toEqual({ phase: "open" });
    await fireEvent.click(screen.getByText("Clear all filters"));
    await flush();
    expect(list.query.value.filters).toEqual({});
  });

  it("the first-use slot replaces the empty state only when nothing narrows the list", async () => {
    const { list } = await mountList({ rows: [], emptySlot: true });
    expect(screen.getByText("Add your first customer")).toBeTruthy();
    expect(screen.queryByText("No data")).toBeNull();
    list.search("ana");
    await flush();
    expect(screen.queryByText("Add your first customer")).toBeNull();
    expect(document.querySelector("[data-test='collection-empty-filtered']")).toBeTruthy();
  });

  it("a cell slot that renders nothing is respected: no raw value comes back in its place", async () => {
    restoreViewport();
    restoreViewport = viewport(true);
    await mountList({ blankCity: true });
    const rows = document.querySelectorAll("[data-test='collection-row']");
    expect(rows[0]!.querySelector(".text-row-meta")!.textContent).toContain("Split");
    expect(rows[1]!.querySelector(".text-row-meta")!.textContent).not.toMatch(/null|undefined/);
  });

  it("puts the page actions in the page shell and the total in the title", async () => {
    const onClick = vi.fn();
    await mountList({ pageActions: [{ id: "create", label: "New customer", placement: "primary", onClick }] });
    await fireEvent.click(screen.getByRole("button", { name: "New customer" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: /Customers/ }).parentElement!.textContent).toMatch(/Customers\s*2/);
  });

  it("keeps the rows with a status line while refreshing, and a banner with retry when a refresh fails", async () => {
    let mode: "ok" | "hang" | "fail" = "ok";
    const hang = new Promise<never>(() => undefined);
    const { list } = await mountList({ loader: fakeLoader(() => (mode === "hang" ? hang : mode === "fail" ? Promise.reject(new ApiError({ kind: "network", message: "offline" })) : page(CUSTOMERS as never)) as never) });
    mode = "hang";
    void list.refresh();
    await flush();
    expect(screen.getByRole("link", { name: "Ana Horvat" })).toBeTruthy();
    expect(document.querySelector("[data-test='collection-refreshing']")).toBeTruthy();

    mode = "fail";
    await list.refresh();
    await flush();
    expect(screen.getByRole("link", { name: "Ana Horvat" })).toBeTruthy();
    expect(document.querySelector("[data-test='collection-stale']")?.textContent).toContain("offline");
  });
});

describe("sorting, search and paging", () => {
  it("a sortable header is a button with aria-sort; clicking sorts through the loader", async () => {
    const { loader } = await mountList();
    const header = screen.getAllByRole("columnheader")[2]!;
    expect(header.getAttribute("aria-sort")).toBe("descending");
    expect(screen.getAllByRole("columnheader")[0]!.getAttribute("aria-sort")).toBeNull();
    await fireEvent.click(within(header).getByRole("button"));
    await flush();
    expect(header.getAttribute("aria-sort")).toBe("ascending");
    expect(loader.calls.at(-1)!.query).toMatchObject({ sort: "created_at", direction: "asc" });
  });

  it("searches from three characters, debounced, and follows the state", async () => {
    const { list, loader } = await mountList({ state: "memory" });
    vi.useFakeTimers();
    try {
      const field = screen.getByRole("textbox", { name: "Search" });
      await fireEvent.update(field, "an");
      vi.advanceTimersByTime(400);
      expect(list.query.value.search).toBe("");
      await fireEvent.update(field, "ana");
      vi.advanceTimersByTime(400);
      await nextTick();
      expect(list.query.value.search).toBe("ana");
      expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy();
      list.clearFilters();
      await nextTick();
      expect((field as HTMLInputElement).value).toBe("");
      expect(loader.calls.length).toBeGreaterThan(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("marks the search text in the identity cell's title, on the table and the phone row", async () => {
    const { list } = await mountList({ state: "memory" });
    list.search("ana HOR");
    await flush();
    expect([...document.querySelectorAll("mark")].map((mark) => mark.textContent)).toEqual(["Ana", "Hor"]);
    expect(document.querySelector("mark")!.closest("a")!.textContent?.trim()).toBe("Ana Horvat"); // the name is still one link

    restoreViewport = viewport(true);
    document.body.innerHTML = "";
    const phone = await mountList({ state: "memory" });
    phone.list.search("kov");
    await flush();
    expect([...document.querySelectorAll("mark")].map((mark) => mark.textContent)).toEqual(["Kov"]);
  });

  it("the slash key focuses the search, and is left alone while typing", async () => {
    await mountList();
    const field = screen.getByRole("textbox", { name: "Search" });
    await fireEvent.keyDown(document.body, { key: "/" });
    expect(document.activeElement).toBe(field);
    const other = document.createElement("input");
    document.body.append(other);
    other.focus();
    await fireEvent.keyDown(other, { key: "/" });
    expect(document.activeElement).toBe(other);
  });

  it("lists the list's own shortcuts for a help dialog, in the app's language", async () => {
    await mountList();
    const rows = useShortcutRegistry().value;
    expect(rows).toContainEqual({ group: "list", label: "Search the list", keys: [["/"]] });
  });

  it("does not intercept Tab or the browser's Find shortcut", async () => {
    await mountList();
    const field = screen.getByRole("textbox", { name: "Search" });
    const tab = new KeyboardEvent("keydown", { key: "Tab", cancelable: true, bubbles: true });
    field.dispatchEvent(tab);
    const find = new KeyboardEvent("keydown", { key: "f", ctrlKey: true, cancelable: true, bubbles: true });
    document.body.dispatchEvent(find);
    expect(tab.defaultPrevented).toBe(false);
    expect(find.defaultPrevented).toBe(false);
  });

  it("non-sortable headers stay plain text without aria-sort", async () => {
    await mountList();
    const header = screen.getAllByRole("columnheader")[0]!;
    expect(header.querySelector("button")).toBeNull();
    expect(header.getAttribute("aria-sort")).toBeNull();
  });

  it("pages with capsules and the page size select", async () => {
    const { list, loader } = await mountList({ lastPage: 12, state: "memory" });
    const pager = screen.getByRole("navigation", { name: "Pages" });
    expect(within(pager).getByRole("button", { name: "1" }).getAttribute("aria-current")).toBe("page");
    expect(within(pager).getByRole("button", { name: "12" })).toBeTruthy();
    expect(within(pager).getAllByText("…")).toHaveLength(1);
    await fireEvent.click(within(pager).getByRole("button", { name: "Next page" }));
    await fireEvent.click(within(pager).getByRole("button", { name: "12" }));
    await flush();
    expect(list.query.value.page).toBe(12);
    await fireEvent.update(screen.getByLabelText("Records per page:"), "50");
    await flush();
    expect(loader.calls.at(-1)!.query).toMatchObject({ pageSize: 50, page: 1 });
  });

  it("the state goes to the URL and the record link carries it", async () => {
    const { router, list } = await mountList();
    list.search("ana");
    await flush();
    const state = String(router.currentRoute.value.query.query);
    expect(JSON.parse(atob(state.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(state.length / 4) * 4, "=")))).toMatchObject({ s: "ana", v: 1 });
    expect(list.recordLocation(CUSTOMERS[0]!)).toMatchObject({ query: { from: state } });
  });
});

describe("rows", () => {
  it("a click on the row opens the record once; a link or a text selection inside is left alone", async () => {
    const { router } = await mountList();
    const push = vi.spyOn(router, "push");
    const row = screen.getAllByRole("row")[1]!;
    await fireEvent.click(row.querySelectorAll("td")[1]!);
    await flush();
    expect(router.currentRoute.value.name).toBe("customer");
    expect(router.currentRoute.value.params.customerID).toBe("1");
    expect(router.currentRoute.value.query.from).toBeTruthy();
    expect(push).toHaveBeenCalledTimes(1);

    await router.push("/customers");
    push.mockClear();
    await fireEvent.click(within(screen.getAllByRole("row")[1]!).getByRole("link", { name: "Ana Horvat" }));
    await flush();
    expect(push).toHaveBeenCalledTimes(1); // the link's own navigation, not also the row's

    await router.push("/customers");
    push.mockClear();
    vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "ana@example" } as Selection);
    await fireEvent.click(screen.getAllByRole("row")[1]!.querySelectorAll("td")[1]!);
    expect(push).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("contact text stays selectable: a click on it does not open the record", async () => {
    const { router } = await mountList();
    const push = vi.spyOn(router, "push");
    await fireEvent.click(screen.getByText("ana@example.com"));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText("ana@example.com").hasAttribute("data-row-click-ignore")).toBe(true);
  });

  it("a modified click opens a new tab", async () => {
    await mountList();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    await fireEvent.click(screen.getAllByRole("row")[1]!.querySelectorAll("td")[1]!, { ctrlKey: true });
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^\/customers\/1\?from=/), "_blank");
    open.mockRestore();
  });

  it("right click lists the row's actions; the press that opened the menu does not open the record, and the next click does", async () => {
    const onSelect = vi.fn();
    const { router } = await mountList({ record: true, rowActions: () => [{ key: "call", label: "Call", icon: "search", href: "tel:1", tone: "positive" }, { key: "archive", label: "Archive", icon: "close", onSelect }] });
    const cell = screen.getAllByRole("row")[1]!.querySelectorAll("td")[1]!;
    await fireEvent.contextMenu(cell, { clientX: 5, clientY: 5 });
    await flush();
    expect(screen.getByRole("menuitem", { name: "Call" })).toBeTruthy();
    await fireEvent.click(cell); // the click that follows the context menu
    expect(router.currentRoute.value.name).toBe("customers");
    // ARV kept swallowing the next genuine click after a right click; a new press resets that
    await fireEvent.keyDown(document.body, { key: "Escape" });
    await fireEvent.pointerDown(cell);
    await fireEvent.click(cell);
    await flush();
    expect(router.currentRoute.value.name).toBe("customer");
  });

  it("shows the eye link and leaves the More button out when the record is the row's way in; a command list gets More", async () => {
    await mountList({ rowActions: () => [{ key: "x", label: "X", icon: "close", onSelect: () => undefined }] });
    expect(screen.getAllByRole("link", { name: /View details/ })).toHaveLength(2);
    expect(document.querySelector("[data-test='collection-row-more']")).toBeNull();
  });

  it("More opens the menu and runs the command (command lists, or actionsVisible)", async () => {
    const onSelect = vi.fn();
    await mountList({ record: false, rowActions: () => [{ key: "archive", label: "Archive", icon: "close", onSelect }] });
    const more = screen.getAllByRole("button", { name: /More actions: / });
    expect(more).toHaveLength(2);
    await fireEvent.click(more[0]!);
    await flush();
    await fireEvent.click(screen.getByRole("menuitem", { name: "Archive" }));
    await flush();
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

describe("typed cell slots", () => {
  it("renders a cell slot with the row and the compact flag; the leading mark goes before the identity", async () => {
    await mountList({ withSlots: true });
    const phases = Array.from(document.querySelectorAll("[data-test='phase']")).map((node) => node.textContent);
    expect(phases).toEqual(["d:Open", "d:Closed"]);
    expect(document.querySelectorAll("[data-test='lead']")).toHaveLength(2);
  });
});

describe("phone rows", () => {
  it("builds the row from the column roles: primary, accessory and meta; a blank meta is left out", async () => {
    restoreViewport();
    restoreViewport = viewport(true);
    await mountList({ withSlots: true });
    expect(document.querySelector("table")).toBeNull();
    const rows = document.querySelectorAll("[data-test='collection-mobile-rows'] [data-test='collection-row']");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain("Ana Horvat");
    expect(rows[0]!.querySelector("[data-test='phase']")!.textContent).toBe("c:Open");
    expect(rows[0]!.querySelector("[data-test='lead']")).toBeTruthy();
    expect(rows[0]!.querySelector(".text-row-meta")!.textContent).toContain("Split");
    expect(rows[1]!.querySelector(".text-row-meta")!.textContent).not.toContain("null");
  });

  it("keeps the table on phones when no column has a role", async () => {
    restoreViewport();
    restoreViewport = viewport(true);
    const { list } = await mountList();
    expect(list.columns.value.some((column) => column.mobile)).toBe(true);
  });

  it("uses the compact pager, and nothing when everything fits on one page", async () => {
    restoreViewport();
    restoreViewport = viewport(true);
    const { unmount } = await mountList({ lastPage: 4 });
    expect(screen.getByText("Page 1 of 4")).toBeTruthy();
    unmount();
    document.body.innerHTML = "";
    await mountList({ lastPage: 1 });
    expect(screen.queryByText(/Page 1 of/)).toBeNull();
  });

  it("moves every filter except free text into the sheet behind one Filters button", async () => {
    restoreViewport();
    restoreViewport = viewport(true);
    await mountList({ filters: [{ key: "phase", label: "Phase", type: "select", options: [{ value: "open", label: "Open" }] }, { key: "location", label: "Code", type: "text" }] });
    expect(screen.getByRole("button", { name: /^Filters/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Phase" })).toBeNull();
    expect(screen.getByRole("button", { name: "Code" })).toBeTruthy();
  });
});

describe("filters", () => {
  const filters: FilterDescriptor<"phase" | "location">[] = [
    { key: "phase", label: "Phase", type: "select", options: [{ value: 1, label: "Open" }, { value: 2, label: "Closed" }] },
    { key: "location", label: "Location", type: "select", placement: "panel", options: [{ value: "a", label: "Split" }, { value: "b", label: "Zagreb" }] },
  ];

  it("a toolbar filter offers its options in a menu, marks the current one and shows its label applied", async () => {
    const { list } = await mountList({ filters });
    await fireEvent.click(screen.getByRole("button", { name: "Phase" }));
    await flush();
    await fireEvent.click(screen.getByRole("menuitemradio", { name: "Open" }));
    await flush();
    expect(list.query.value.filters).toEqual({ phase: "1" });
    // the URL brought the value back as text and the option holds a number: still the same option
    expect(screen.getByRole("button", { name: "Open" })).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await flush();
    expect(screen.getByRole("menuitemradio", { name: "Open" }).getAttribute("aria-checked")).toBe("true");
  });

  it("the panel applies several filters in one request and shows them as tokens", async () => {
    const { list, loader } = await mountList({ filters });
    await fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    await flush();
    const dialog = screen.getByRole("dialog");
    await fireEvent.click(within(dialog).getByRole("button", { name: "Location" }));
    await flush();
    await fireEvent.click(screen.getByRole("option", { name: "Zagreb" }).querySelector("button")!);
    await flush();
    const before = loader.calls.length;
    await fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Apply" }));
    await flush();
    expect(list.query.value.filters).toEqual({ location: "b" });
    expect(loader.calls.length).toBe(before + 1);
    expect(document.querySelector("[data-test='collection-filter-chips']")!.textContent).toContain("Zagreb");
  });

  it("the panel edits a range with two number fields and applies it as one value; a typed decimal comma is understood", async () => {
    const { list } = await mountList({ filters: [{ key: "location", label: "Price", type: "range", placement: "panel", unit: "EUR", decimals: 2 }] });
    await fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    await flush();
    const dialog = screen.getByRole("dialog");
    await fireEvent.update(within(dialog).getByLabelText("From"), "1000");
    await fireEvent.update(within(dialog).getByLabelText("Until"), "2500,5");
    await fireEvent.click(within(dialog).getByRole("button", { name: "Apply" }));
    await flush();
    expect(list.query.value.filters).toEqual({ location: "1000,2500.5" });
  });

  it("saved views: saved from the panel, listed in the toolbar and applied in one request", async () => {
    const savedViews = createMemorySavedViews({ customers: [{ id: 1, name: "Split only", state: { version: 1, filters: { location: "a" }, search: "" } }] });
    const { list } = await mountList({ filters, savedViews });
    await fireEvent.click(screen.getByRole("button", { name: "Saved filters" }));
    await flush();
    await fireEvent.click(screen.getByRole("menuitem", { name: "Split only" }));
    await flush();
    expect(list.query.value.filters).toEqual({ location: "a" });
  });
});

describe("views", () => {
  it("scope tabs switch the view and keep the state", async () => {
    const { list } = await mountList();
    await fireEvent.click(screen.getByRole("tab", { name: "Mine" }));
    await flush();
    expect(list.query.value.view).toBe("mine");
  });
});
