import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { createTestI18n } from "../testing/i18n";
import type { NavigationItem } from "../router/navigation";
import NavigationList from "./NavigationList.vue";
import { groupNavigation } from "./navigationGroups";

const item = (label: string, options: { to?: string; active?: boolean; icon?: string; children?: NavigationItem[] } = {}): NavigationItem => ({
  key: `/${label}`,
  label,
  icon: options.icon ?? null,
  to: options.to ?? null,
  active: options.active ?? false,
  children: options.children ?? [],
});

describe("groupNavigation", () => {
  it("gives a group of two or more a heading, a lone destination a hairline, and skips the first hairline", () => {
    const groups = groupNavigation([
      item("Used", { children: [item("Appraisals", { to: "/a" }), item("Takeovers", { to: "/t" })] }),
      item("Market", { children: [item("Catalogue", { to: "/c" })] }),
    ]);
    expect(groups.map((group) => [group.heading, group.separated, group.items.map((each) => each.label)])).toEqual([
      ["Used", false, ["Appraisals", "Takeovers"]],
      [null, true, ["Catalogue"]],
    ]);
    expect(groupNavigation([item("Market", { children: [item("Catalogue", { to: "/c" })] })])[0]).toMatchObject({ heading: null, separated: false });
  });

  it("lists the links of a group without a route through it, and a destination's sections are not links", () => {
    const [group] = groupNavigation([
      item("New vehicles", {
        children: [
          item("Distribution", { children: [item("Ordered", { to: "/o" }), item("Dispatch", { to: "/d" })] }),
          item("Stock", { to: "/s", children: [item("Equipment", { to: "/s/e" })] }),
        ],
      }),
    ]);
    expect(group!.items.map((each) => each.label)).toEqual(["Ordered", "Dispatch", "Stock"]);
  });

  it("makes a top-level destination a group of one, and drops a group with nothing to open", () => {
    const groups = groupNavigation([
      item("Home", { to: "/" }),
      item("Empty", { children: [item("Nothing")] }),
      item("Sales", { children: [item("Leads", { to: "/l" }), item("Customers", { to: "/c" })] }),
    ]);
    expect(groups.map((group) => [group.heading, group.separated, group.items.map((each) => each.label)])).toEqual([
      [null, false, ["Home"]],
      ["Sales", false, ["Leads", "Customers"]],
    ]);
  });

  it("carries the active state of each destination", () => {
    const [group] = groupNavigation([item("Sales", { children: [item("Leads", { to: "/l", active: true }), item("Customers", { to: "/c" })] })]);
    expect(group!.items.map((each) => each.active)).toEqual([true, false]);
  });
});

async function mountList(props: Record<string, unknown>) {
  const router = createRouter({ history: createMemoryHistory(), routes: ["/a", "/t", "/c"].map((path) => ({ path, component: { render: () => null } })) });
  await router.push("/a");
  const view = render(NavigationList, { props, global: { plugins: [router, createTestI18n()] } });
  return { router, ...view };
}

const tree = [
  item("Used", { children: [item("Appraisals", { to: "/a", active: true, icon: "search" }), item("Takeovers", { to: "/t", icon: "noSuchIcon" })] }),
  item("Market", { children: [item("Catalogue", { to: "/c" })] }),
];

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("NavigationList", () => {
  it("renders the groups as links, marks the current one and names the landmark", async () => {
    await mountList({ items: tree });

    expect(screen.getByRole("navigation", { name: "Menu" })).toBeTruthy();
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent?.trim())).toEqual(["Appraisals", "Takeovers", "Catalogue"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/a", "/t", "/c"]);
    expect(links.map((link) => link.getAttribute("aria-current"))).toEqual(["page", null, null]);
    expect(screen.getByText("Used")).toBeTruthy(); // a heading over two links
    expect(screen.queryByText("Market")).toBeNull(); // none over one
    expect(screen.getAllByRole("separator")).toHaveLength(1);
  });

  it("draws the icons the application has and quietly skips the ones it lacks", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { container } = await mountList({ items: tree });

    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("the rail navigates by itself; the drawer reports the tap and leaves the route to its owner", async () => {
    const rail = await mountList({ items: tree, appearance: "rail" });
    await fireEvent.click(screen.getByRole("link", { name: "Takeovers" }));
    await settle();
    expect(rail.router.currentRoute.value.path).toBe("/t");
    rail.unmount();

    const drawer = await mountList({ items: tree, appearance: "drawer" });
    await fireEvent.click(screen.getByRole("link", { name: "Catalogue" }));
    await settle();
    expect(drawer.emitted().select).toEqual([["/c"]]);
    expect(drawer.router.currentRoute.value.path).toBe("/a");
  });

  it("the drawer leaves a modified click to the browser (a new tab)", async () => {
    const drawer = await mountList({ items: tree, appearance: "drawer" });
    await fireEvent.click(screen.getByRole("link", { name: "Catalogue" }), { ctrlKey: true });
    expect(drawer.emitted().select).toBeUndefined();
  });

  it("without items it needs the application's menu and says so", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => render(NavigationList, { global: { plugins: [createTestI18n()] } })).toThrow(/vue-core\.navigation/);
    warn.mockRestore();
  });
});
