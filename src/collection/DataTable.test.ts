import { fireEvent, render, screen, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { createTestI18n, mockMedia, testFormatting } from "../testing";
import DataTable from "./DataTable.vue";
import RowActions from "./RowActions.vue";
import type { RowAction, TableColumns } from "./columns";
import { flush } from "./testing";

interface Order {
  readonly id: number;
  readonly name: string;
  readonly total: number;
  readonly status: "open" | "paid";
  readonly placed_at: string;
}

const ORDERS: Order[] = [
  { id: 1, name: "Winter tyres", total: 480, status: "open", placed_at: "2026-09-01T10:30:00Z" },
  { id: 2, name: "Service", total: 120.5, status: "paid", placed_at: "2026-09-02T08:00:00Z" },
];

const columns = [
  { key: "name", label: "Order", kind: "identity", mobile: "primary" },
  { key: "total", label: "Total", kind: "number", align: "end", width: 100, mobile: "meta" },
  { key: "status", label: "Status", kind: "badge", tone: (order: Order) => (order.status === "paid" ? "positive" : "warning"), mobile: "accessory" },
  { key: "placed_at", label: "Placed", kind: "timestamp", precision: "date", hideBelow: "md", mobile: "meta" },
] satisfies TableColumns<Order>;

const i18n = createTestI18n();

function viewport(narrow: boolean) {
  return mockMedia({ narrow }).restore;
}

let restore: () => void = () => undefined;
afterEach(() => {
  restore();
  restore = () => undefined;
  document.body.innerHTML = "";
});

interface Setup {
  rows?: readonly Order[];
  cols?: TableColumns<Order>;
  props?: Record<string, unknown>;
  slots?: Record<string, (scope: { item: Order; compact?: boolean }) => unknown>;
  emptySlot?: boolean;
  narrow?: boolean;
}

async function mountTable(setup: Setup = {}) {
  if (setup.narrow) restore = viewport(true);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: { render: () => h("div") } },
      { path: "/orders/:id", name: "order", component: { render: () => h("div", "order page") } },
    ],
  });
  await router.push("/");
  await router.isReady();
  const view = render(
    defineComponent({
      render: () =>
        h(DataTable as never, { rows: setup.rows ?? ORDERS, columns: setup.cols ?? columns, rowKey: (order: Order) => order.id, ...setup.props } as never, {
          ...(setup.slots ?? {}),
          ...(setup.emptySlot ? { empty: () => h("p", { "data-test": "nothing" }, "No orders yet") } : {}),
        }),
    }),
    { global: { plugins: [router, i18n, testFormatting(i18n)] } },
  );
  await flush();
  return { ...view, router };
}

describe("DataTable", () => {
  it("renders the labels and one row per item, cells by the column kind", async () => {
    await mountTable();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent?.trim())).toEqual(["Order", "Total", "Status", "Placed"]);
    const rows = table.querySelectorAll("[data-test='collection-row']");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain("Winter tyres");
    expect(rows[0]!.textContent).toContain("480");
    expect(rows[1]!.textContent).toContain("120.5");
  });

  it("has no search, filters, pager or card of its own", async () => {
    await mountTable();
    expect(document.querySelector("[data-test='collection-toolbar']")).toBeNull();
    expect(document.querySelector("[data-test='collection-pager-compact']")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(document.querySelector(".shadow-group")).toBeNull();
  });

  it("aligns and sizes a column, and leaves a column out below its width", async () => {
    await mountTable();
    const headers = screen.getAllByRole("columnheader");
    expect(headers[1]!.style.width).toBe("100px");
    expect(headers[1]!.style.textAlign).toBe("end");
    expect(headers[3]!.className).toContain("hidden md:table-cell");
  });

  it("a cell slot replaces the column's rendering and receives the item, the value and compact", async () => {
    await mountTable({
      slots: { "cell-status": ({ item, compact }) => h("b", { "data-test": "status" }, `${item.status}:${String(compact)}`) },
    });
    expect(Array.from(document.querySelectorAll("[data-test='status']")).map((node) => node.textContent)).toEqual(["open:false", "paid:false"]);
  });

  it("renders a cell slot the parent adds after the first render", async () => {
    const shown = ref(false);
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/", component: { render: () => h("div") } }] });
    await router.push("/");
    render(
      defineComponent({
        render: () =>
          h(DataTable as never, { rows: ORDERS, columns, rowKey: (order: Order) => order.id } as never,
            shown.value ? { "cell-status": ({ item }: { item: Order }) => h("span", { "data-test": "late" }, item.status) } : {}),
      }),
      { global: { plugins: [router, i18n, testFormatting(i18n)] } },
    );
    await flush();
    expect(document.querySelectorAll("[data-test='late']")).toHaveLength(0);
    shown.value = true;
    await flush();
    expect(document.querySelectorAll("[data-test='late']")).toHaveLength(2);
  });

  it("shows skeleton rows instead of the rows while loading", async () => {
    await mountTable({ props: { loading: true, skeletonRows: 2 } });
    expect(document.querySelectorAll("tbody tr[aria-hidden='true']")).toHaveLength(2);
    expect(document.querySelector("[data-test='collection-row']")).toBeNull();
    expect(document.querySelector("[data-test='data-table']")!.getAttribute("aria-busy")).toBe("true");
  });

  it("shows No data when there are no rows, or the empty slot", async () => {
    const first = await mountTable({ rows: [] });
    expect(screen.getByText("No data")).toBeTruthy();
    first.unmount();
    await mountTable({ rows: [], emptySlot: true });
    expect(screen.getByText("No orders yet")).toBeTruthy();
    expect(screen.queryByText("No data")).toBeNull();
  });

  it("does not show the empty state while loading", async () => {
    await mountTable({ rows: [], props: { loading: true } });
    expect(screen.queryByText("No data")).toBeNull();
  });

  it("adds the row class the caller asks for", async () => {
    await mountTable({ props: { rowClass: (order: Order) => (order.id === 2 ? "total-row" : undefined) } });
    const rows = document.querySelectorAll("[data-test='collection-row']");
    expect(rows[0]!.classList.contains("total-row")).toBe(false);
    expect(rows[1]!.classList.contains("total-row")).toBe(true);
  });

  it("condensed density tightens the cells", async () => {
    await mountTable({ props: { density: "condensed" } });
    expect(document.querySelector("table")!.classList.contains("condensed")).toBe(true);
  });

  it("keeps the order it was given, with no sortable header", async () => {
    await mountTable();
    expect(screen.queryAllByRole("columnheader").some((header) => header.hasAttribute("aria-sort"))).toBe(false);
    expect(within(screen.getByRole("table")).queryAllByRole("button")).toHaveLength(0);
  });

  it("follows its rows when they change", async () => {
    const view = await mountTable();
    await view.rerender({ rows: [ORDERS[1]] });
    await flush();
    expect(document.querySelectorAll("[data-test='collection-row']")).toHaveLength(1);
  });

  it("rows with a record route open it on click, and the identity cell links to it", async () => {
    const { router } = await mountTable({ props: { recordRoute: (order: Order) => ({ name: "order", params: { id: order.id } }) } });
    expect(screen.getByRole("link", { name: "Winter tyres" }).getAttribute("href")).toBe("/orders/1");
    await fireEvent.click(document.querySelectorAll("[data-test='collection-row']")[1]!.querySelector("td")!);
    await flush();
    expect(router.currentRoute.value.fullPath).toBe("/orders/2");
  });

  it("without a record route a row is not a link", async () => {
    const { router } = await mountTable();
    expect(screen.queryByRole("link")).toBeNull();
    await fireEvent.click(document.querySelector("[data-test='collection-row'] td")!);
    expect(router.currentRoute.value.fullPath).toBe("/");
  });

  describe("row actions", () => {
    const actions = (order: Order, onSelect: (what: string) => void): RowAction[] => [
      { key: "edit", label: `Edit ${order.name}`, icon: "eye", onSelect: () => onSelect(`edit ${order.id}`) },
      { key: "delete", label: "Delete", icon: "deleteBin2Line", tone: "critical", onSelect: () => onSelect(`delete ${order.id}`) },
    ];

    it("the actions slot is the actions column; RowActions renders them as buttons that run", async () => {
      const chosen = vi.fn();
      await mountTable({ slots: { actions: ({ item }) => h(RowActions, { actions: actions(item, chosen) }) } });
      expect(screen.getAllByRole("columnheader")).toHaveLength(5);
      await fireEvent.click(screen.getByRole("button", { name: "Edit Service" }));
      await fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]!);
      expect(chosen.mock.calls.map((call) => call[0])).toEqual(["edit 2", "delete 1"]);
    });

    it("a critical action is red, and disabled greys out every button without running it", async () => {
      const chosen = vi.fn();
      await mountTable({ slots: { actions: ({ item }) => h(RowActions, { actions: actions(item, chosen), disabled: item.id === 1 }) } });
      const first = document.querySelectorAll("[data-test='collection-row']")[0]!;
      const buttons = within(first as HTMLElement).getAllByRole("button");
      expect(buttons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
      await fireEvent.click(buttons[0]!);
      expect(chosen).not.toHaveBeenCalled();
      const second = within(document.querySelectorAll("[data-test='collection-row']")[1] as HTMLElement).getAllByRole("button");
      expect(second[1]!.className).toContain("text-status-danger-content");
      expect(second[0]!.className).not.toContain("text-status-danger-content");
    });

    it("a link action is an anchor; an external one opens a new tab", async () => {
      await mountTable({
        slots: {
          actions: () =>
            h(RowActions, {
              actions: [
                { key: "open", label: "Open", icon: "eye", href: "/somewhere" },
                { key: "doc", label: "Document", icon: "download", href: "https://example.com/doc.pdf", external: true },
              ],
            }),
        },
      });
      const open = screen.getAllByRole("link", { name: "Open" })[0]!;
      expect(open.getAttribute("href")).toBe("/somewhere");
      const doc = screen.getAllByRole("link", { name: "Document" })[0]!;
      expect(doc.getAttribute("target")).toBe("_blank");
      expect(doc.getAttribute("rel")).toBe("noopener");
    });

    it("renders nothing for a row without actions", () => {
      const { container } = render(RowActions, { props: { actions: [] }, global: { plugins: [i18n] } });
      expect(container.querySelector("[data-test='row-actions']")).toBeNull();
    });

    it("rowActions give a More button that lists them", async () => {
      const chosen = vi.fn();
      await mountTable({ props: { rowActions: (order: Order) => actions(order, chosen), rowLabel: (order: Order) => order.name } });
      expect(document.querySelectorAll("[data-test='collection-row-more']")).toHaveLength(2);
      await fireEvent.click(screen.getByRole("button", { name: "More actions: Service" }));
      await flush();
      await fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
      expect(chosen).toHaveBeenCalledWith("delete 2");
    });

    it("a right click lists the row's actions too", async () => {
      await mountTable({ props: { rowActions: (order: Order) => actions(order, () => undefined), rowLabel: (order: Order) => order.name } });
      await fireEvent.contextMenu(document.querySelector("[data-test='collection-row'] td")!);
      await nextTick();
      await flush();
      expect(await screen.findByRole("menuitem", { name: "Edit Winter tyres" })).toBeTruthy();
    });
  });

  describe("on a phone", () => {
    it("stays a table when no column has a mobile role", async () => {
      await mountTable({ narrow: true, cols: columns.map(({ mobile: _mobile, ...column }) => column) as unknown as TableColumns<Order> });
      expect(screen.getByRole("table")).toBeTruthy();
    });

    it("becomes rows built from the roles: primary, accessory and meta, with compact cells", async () => {
      await mountTable({ narrow: true, slots: { "cell-status": ({ item, compact }) => h("b", { "data-test": "status" }, `${item.status}:${String(compact)}`) } });
      expect(document.querySelector("table")).toBeNull();
      const rows = document.querySelectorAll("[data-test='collection-mobile-rows'] [data-test='collection-row']");
      expect(rows).toHaveLength(2);
      expect(rows[0]!.textContent).toContain("Winter tyres");
      expect(rows[0]!.querySelector("[data-test='status']")!.textContent).toBe("open:true");
      expect(rows[0]!.querySelector(".text-row-meta")!.textContent).toContain("480");
    });

    it("shows the skeleton and the empty state as rows", async () => {
      const loading = await mountTable({ narrow: true, props: { loading: true, skeletonRows: 2 } });
      expect(document.querySelectorAll("[data-test='collection-mobile-rows'] li[aria-hidden='true']")).toHaveLength(2);
      loading.unmount();
      await mountTable({ narrow: true, rows: [] });
      expect(screen.getByText("No data")).toBeTruthy();
    });
  });

  describe("pick mode", () => {
    for (const narrow of [false, true]) {
      it(`a click or Enter picks the row, not a button in it, and the row is no link (narrow: ${narrow})`, async () => {
        const pick = vi.fn();
        await mountTable({ narrow, props: { pick, recordRoute: (order: Order) => ({ name: "order", params: { id: order.id } }) }, slots: { "cell-status": () => h("button", { type: "button" }, "Pay") } });
        const rows = [...document.querySelectorAll<HTMLElement>("[role='option']")];
        expect(rows).toHaveLength(2);
        expect(screen.queryAllByRole("link")).toHaveLength(0);
        await fireEvent.click(within(rows[0]!).getByRole("button", { name: "Pay" }));
        expect(pick).not.toHaveBeenCalled();
        await fireEvent.click(rows[1]!);
        expect(pick).toHaveBeenLastCalledWith(ORDERS[1]);
        const list = screen.getByRole("listbox", { name: "Choose one" });
        await fireEvent.focus(list);
        await fireEvent.keyDown(list, { key: "ArrowDown" });
        await fireEvent.keyDown(list, { key: "Enter" });
        expect(pick).toHaveBeenLastCalledWith(ORDERS[1]);
        expect(pick).toHaveBeenCalledTimes(2);
      });
    }

    it("is a listbox only with rows, and takes the caller's name", async () => {
      await mountTable({ rows: [], props: { pick: vi.fn(), pickLabel: "Choose an order" } });
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(document.querySelector("[data-test='collection-empty']")).toBeTruthy();
    });

    it("names the choices", async () => {
      await mountTable({ props: { pick: vi.fn(), pickLabel: "Choose an order" } });
      expect(screen.getByRole("listbox", { name: "Choose an order" })).toBeTruthy();
    });
  });
});
