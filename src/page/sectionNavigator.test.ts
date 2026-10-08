import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, ref, shallowRef } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter, type RouteRecordRaw } from "vue-router";
import { coreMessages } from "../i18n";
import { createAccessClient, platformKey, type AccessSnapshot, type Platform } from "../platform";
import { accessOf, held } from "../platform/testing";
import { AppRouterView, createRouteAccess, routeAccessKey } from "../router/access";
import type { PageSectionBack } from "./types";
import { pageSectionBackKey } from "./sectionBack";
import SectionNavigator from "./SectionNavigator.vue";
import SectionPanel from "./SectionPanel.vue";

const i18n = createI18n({
  legacy: false,
  locale: "en",
  messages: {
    en: {
      ...coreMessages.en,
      record: { general: "General data", general_short: "General", notes: "Notes", audit: "Audit log", location: "Location", group_a: "Record", group_b: "Settings", sections: "Parts of the record" },
    },
  },
});

const settle = async () => {
  for (let index = 0; index < 5; index++) await new Promise((resolve) => setTimeout(resolve, 0));
};

// `mockMedia` answers the library's compact query only; this page navigator also asks for the wide one.
const original = window.matchMedia;
function screenWidth(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    media: query,
    matches: query.includes("min-width: 64rem") ? wide : false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}
afterEach(() => {
  window.matchMedia = original;
  document.body.innerHTML = "";
});

const text = (label: string) => defineComponent({ render: () => h("p", { "data-section-content": "" }, label) });
const panels = defineComponent({
  render: () => [h(SectionPanel, { title: "Identification" }, () => "a"), h(SectionPanel, { title: "Contact" }, () => "b"), h(SectionPanel, { title: "Equipment" }, () => "c")],
});

function routes(page: ReturnType<typeof defineComponent>): RouteRecordRaw[] {
  const section = (labelKey: string, icon: "informationLine" | "box2Line" | "search", extra: object = {}) => ({ labelKey, icon, ...extra });
  return [
    {
      name: "record",
      path: "/records/:recordID",
      component: page,
      children: [
        { name: "record.general", path: "general", component: text("general content"), meta: { section: section("record.general", "informationLine", { shortLabelKey: "record.general_short", groupKey: "record.group_a" }) } },
        { name: "record.notes", path: "notes", component: panels, meta: { access: "notes:view", section: section("record.notes", "box2Line", { groupKey: "record.group_a" }) } },
        { name: "record.audit", path: "audit", component: text("audit content"), meta: { access: "audit:view", section: section("record.audit", "search", { groupKey: "record.group_b" }) } },
        { name: "record.note", path: "notes/:noteID", component: text("one note"), meta: { access: "notes:view", sectionParent: "record.notes" } },
      ],
    },
  ];
}

interface Options {
  permissions?: string[];
  path?: string;
  props?: Record<string, unknown>;
  summary?: boolean;
  counts?: Record<string, number>;
}

async function mountRecord(wide: boolean, options: Options = {}) {
  screenWidth(wide);
  const snapshot = shallowRef<AccessSnapshot>(accessOf(Object.fromEntries((options.permissions ?? ["notes:view", "audit:view"]).map((name) => [name, held("organization", undefined)]))));
  const access = createAccessClient(() => snapshot.value);
  const back = ref<PageSectionBack | null>(null);
  const Page = defineComponent({
    setup() {
      return () =>
        h(
          SectionNavigator,
          { label: "Parts of the record", counts: options.counts, ...options.props },
          { default: () => h(AppRouterView), ...(options.summary ? { summary: () => h("aside-summary", { "data-test": "summary" }, "Summary card") } : {}) },
        );
    },
  });
  const router = createRouter({ history: createMemoryHistory(), routes: routes(Page) });
  await router.push(options.path ?? "/records/3/general");
  const routeAccess = createRouteAccess({ router, access, noAccess: defineComponent({ render: () => h("p", { "data-test": "no-access" }, "No access") }) });
  const view = render(defineComponent({ render: () => h(AppRouterView) }), {
    global: {
      plugins: [router, i18n],
      provide: { [platformKey as symbol]: { access } as unknown as Platform, [routeAccessKey as symbol]: routeAccess, [pageSectionBackKey as symbol]: back },
    },
    container: document.body.appendChild(document.createElement("div")),
  });
  await settle();
  const links = () => [...document.querySelectorAll<HTMLElement>('nav[aria-label="Parts of the record"] a')].map((link) => link.textContent?.replace(/\s+/g, " ").trim());
  return {
    ...view,
    router,
    back,
    links,
    navigator: () => document.querySelector<HTMLElement>('[data-test="section-navigator"]'),
    content: () => document.querySelector("[data-section-content]")?.textContent ?? null,
    grant: async (...names: string[]) => {
      snapshot.value = accessOf(Object.fromEntries(names.map((name) => [name, held("organization", undefined)])));
      await settle();
    },
  };
}

describe("SectionNavigator on compact screens", () => {
  it("shows a segmented control of short labels, the current one marked, in front of the section", async () => {
    const page = await mountRecord(false);
    expect(page.navigator()?.dataset.variant).toBe("segmented");
    expect(page.links()).toEqual(["General", "Notes", "Audit log"]);
    const current = document.querySelector('nav[aria-label="Parts of the record"] [aria-current="page"]');
    expect(current?.textContent).toContain("General");
    expect(page.content()).toBe("general content");
  });

  it("puts the summary before the section links", async () => {
    await mountRecord(false, { summary: true });
    const summary = document.querySelector('[data-test="summary"]')!;
    const nav = document.querySelector('nav[aria-label="Parts of the record"]')!;
    expect(summary.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows a quiet count beside a section", async () => {
    await mountRecord(false, { counts: { "record.notes": 4 } });
    expect(document.querySelector('[data-test="section-count"]')?.textContent).toBe("4");
  });

  it("shows drill-in rows on the first section only, grouped by heading, and the summary with them", async () => {
    const page = await mountRecord(false, { props: { compact: "rows", backLabel: "Record 3" }, summary: true });
    const rows = document.querySelector('[data-test="section-rows"]')!;
    expect(rows.textContent).toContain("Notes");
    expect(rows.textContent).toContain("Audit log");
    expect([...rows.querySelectorAll("h3")].map((heading) => heading.textContent)).toEqual(["Record", "Settings"]);
    expect(rows.textContent).not.toContain("General data");
    expect(document.querySelector('[data-test="summary"]')).toBeTruthy();
    expect(page.back.value).toBeNull();

    await page.router.push("/records/3/notes");
    await settle();
    expect(document.querySelector('[data-test="section-rows"]')).toBeNull();
    expect(document.querySelector('[data-test="summary"]')).toBeNull();
    expect(page.back.value).toMatchObject({ label: "Record 3" });
  });

  it("chooses rows beyond five sections and a segmented control up to five (auto)", async () => {
    const page = await mountRecord(false, { props: { compact: "auto" } });
    expect(page.navigator()?.dataset.variant).toBe("segmented");
  });

  it("does not show the rows above a page inside the first section", async () => {
    const page = await mountRecord(false, { props: { compact: "rows" }, path: "/records/3/notes/9", permissions: ["notes:view"] });
    expect(document.querySelector('[data-test="section-rows"]')).toBeNull();
    expect(page.content()).toBe("one note");
  });
});

describe("SectionNavigator on wide screens", () => {
  it("shows a source list beside the content, with group headings, and exactly one sidebar", async () => {
    const page = await mountRecord(true, { props: { desktop: "sidebar" }, summary: true });
    expect(page.navigator()?.dataset.variant).toBe("sidebar");
    expect(page.links()).toEqual(["General data", "Notes", "Audit log"]);
    expect([...document.querySelectorAll('[data-test="section-group"]')].map((group) => group.textContent?.trim())).toEqual(["Record", "Settings"]);
    expect(document.querySelectorAll("aside")).toHaveLength(1);
    expect(document.querySelectorAll('nav[aria-label="Parts of the record"]')).toHaveLength(1);
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
  });

  it("puts the summary above the links in that same sidebar", async () => {
    await mountRecord(true, { props: { desktop: "sidebar" }, summary: true });
    const aside = document.querySelector("aside")!;
    const summary = aside.querySelector('[data-test="summary"]')!;
    const nav = aside.querySelector("nav")!;
    expect(summary.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.querySelectorAll('[data-test="summary"]')).toHaveLength(1);
  });

  it("shows segments of full labels", async () => {
    const page = await mountRecord(true);
    expect(page.navigator()?.dataset.variant).toBe("segments");
    expect(page.links()).toEqual(["General data", "Notes", "Audit log"]);
  });

  it("lists the in-page sections of the active section under it", async () => {
    await mountRecord(true, { props: { desktop: "sidebar" }, path: "/records/3/notes" });
    const list = document.querySelector('[data-test="section-list"]')!;
    expect([...list.querySelectorAll("a")].map((link) => link.textContent?.trim())).toEqual(["Identification", "Contact", "Equipment"]);
    expect(list.closest("li")?.querySelector('[data-test="section-record.notes"]')).toBeTruthy();
  });

  it("carries the page's query (a list's state) on the links to other sections", async () => {
    const page = await mountRecord(true, { path: "/records/3/general?from=abc" });
    await page.router.push("/records/3/notes?from=abc");
    await settle();
    expect(document.querySelector<HTMLAnchorElement>('[data-test="section-record.audit"]')?.getAttribute("href")).toContain("from=abc");
  });
});

describe("SectionNavigator on compact screens, long pages", () => {
  it("offers the floating jumper for three or more in-page sections, not a second list", async () => {
    await mountRecord(false, { path: "/records/3/notes" });
    expect(document.querySelector('[data-test="section-jumper"]')).toBeTruthy();
    expect(document.querySelector('[data-test="section-list"]')).toBeNull();
  });
});

describe("SectionNavigator access", () => {
  it("leaves out the sections the session may not open, and renders no navigation for a single one", async () => {
    const page = await mountRecord(true, { permissions: [], props: { desktop: "sidebar" }, summary: true });
    expect(page.links()).toEqual([]);
    expect(page.navigator()?.dataset.variant).toBe("none");
    expect(page.content()).toBe("general content");
    expect(document.querySelector('[data-test="summary"]')).toBeTruthy();
  });

  it("moves the bare record URL and a direct link to a section the session may not open to the first one it may", async () => {
    const bare = await mountRecord(false, { path: "/records/3", permissions: ["notes:view"] });
    expect(bare.router.currentRoute.value.name).toBe("record.general");
    bare.unmount();

    const denied = await mountRecord(false, { path: "/records/3/audit", permissions: ["notes:view"] });
    expect(denied.router.currentRoute.value.name).toBe("record.general");
    expect(denied.content()).toBe("general content");
  });

  it("follows a permission taken away while the section is open, and one granted", async () => {
    const page = await mountRecord(true, { path: "/records/3/notes", permissions: ["notes:view"] });
    expect(page.links()).toEqual(["General data", "Notes"]);
    await page.grant("notes:view", "audit:view");
    expect(page.links()).toEqual(["General data", "Notes", "Audit log"]);
    await page.grant();
    expect(page.router.currentRoute.value.name).toBe("record.general");
    expect(page.content()).toBe("general content");
  });

  it("shows a deliberate no-access state when the session may open none of the sections, and does not redirect in a loop", async () => {
    const Page = defineComponent({ setup: () => () => h(SectionNavigator, { label: "Parts" }, { default: () => h(AppRouterView) }) });
    screenWidth(true);
    const access = createAccessClient(() => accessOf({}));
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: "/r/:id",
          component: Page,
          children: [
            { name: "a", path: "a", component: text("a"), meta: { access: "a:view", section: { labelKey: "record.notes", icon: "box2Line" } } },
            { name: "b", path: "b", component: text("b"), meta: { access: "b:view", section: { labelKey: "record.audit", icon: "search" } } },
          ],
        },
      ],
    });
    const navigations: string[] = [];
    router.afterEach((to) => void navigations.push(to.fullPath));
    await router.push("/r/1/b");
    const routeAccess = createRouteAccess({ router, access, noAccess: defineComponent({ render: () => h("p", { "data-test": "no-access" }, "No access") }) });
    render(defineComponent({ render: () => h(AppRouterView) }), {
      global: { plugins: [router, i18n], provide: { [platformKey as symbol]: { access } as unknown as Platform, [routeAccessKey as symbol]: routeAccess, [pageSectionBackKey as symbol]: ref(null) } },
    });
    await settle();
    expect(document.querySelector('[data-test="no-access"]')).toBeTruthy();
    expect(document.querySelector("[data-section-content]")).toBeNull();
    expect(document.querySelectorAll("nav")).toHaveLength(0);
    expect(navigations).toEqual(["/r/1/b"]);
  });
});

describe("SectionNavigator nested pages", () => {
  it.each([false, true])("keeps the section active on a page inside it and gives the page a back to it (wide: %s)", async (wide) => {
    const page = await mountRecord(wide, { props: { desktop: "sidebar", compact: "rows", backLabel: "Record 3" }, path: "/records/3/notes/9" });
    expect(page.content()).toBe("one note");
    expect(document.querySelector('[data-test="section-rows"]')).toBeNull();
    expect(page.back.value?.label).toBe("Notes");
    expect(page.back.value?.path?.map((item) => item.label)).toEqual(["Record 3", "Notes"]);
    if (wide) expect(document.querySelector('[data-test="section-record.notes"]')?.getAttribute("aria-current")).toBe("page");

    // The section itself: drill-in rows (compact) lead back to the first one, a source list (wide) has no back.
    await page.router.push("/records/3/notes");
    await settle();
    expect(page.back.value).toEqual(wide ? null : expect.objectContaining({ label: "Record 3" }));
  });

  it("clears the back when the navigator goes away", async () => {
    const page = await mountRecord(false, { props: { compact: "rows", backLabel: "Record 3" }, path: "/records/3/notes" });
    expect(page.back.value).toMatchObject({ label: "Record 3" });
    page.unmount();
    await nextTick();
    expect(page.back.value).toBeNull();
  });
});

describe("SectionNavigator as a workflow's steps", () => {
  const steps = {
    "record.general": { done: true, sub: "12 400 €" },
    "record.notes": { done: false, sub: "Missing: market comparison", shortSub: "Missing data", tone: "warning" as const },
  };
  const tile = (name: string) => document.querySelector<HTMLElement>(`[data-test="section-${name}"]`)!;

  it.each([true, false])("shows large tiles in order on every width (wide: %s), the shown one marked", async (wide) => {
    const page = await mountRecord(wide, { props: { steps } });
    expect(page.navigator()?.dataset.variant).toBe("steps");
    expect(document.querySelectorAll('[data-test="section-steps"] li')).toHaveLength(3);
    expect(tile("record.notes").getAttribute("aria-current")).toBeNull();
    expect(tile("record.general").getAttribute("aria-current")).toBe("step");
    expect(tile("record.general").className).toContain("bg-tint-soft");
    expect(page.content()).toBe("general content");
  });

  it("shows ✓ and a screen-reader note on a done step, its number on the others", async () => {
    await mountRecord(true, { props: { steps } });
    expect(tile("record.general").getAttribute("data-done")).toBe("true");
    expect(tile("record.general").textContent).toContain("done");
    expect(tile("record.general").querySelector("svg")).not.toBeNull();
    expect(tile("record.notes").textContent).toMatch(/^2/);
    expect(tile("record.audit").textContent).toMatch(/^3/);
    expect(tile("record.audit").getAttribute("data-done")).toBeNull();
  });

  it("says in one line where a step stands, in its tone, with a shorter line for phones; a step without a state has none", async () => {
    await mountRecord(true, { props: { steps } });
    const sub = tile("record.notes").querySelector('[data-test="section-step-sub"]')!;
    expect(sub.className).toContain("text-status-warning-content");
    const [full, short] = sub.querySelectorAll("span");
    expect(full!.textContent).toBe("Missing: market comparison");
    expect(full!.className).toContain("compact:hidden");
    expect(short!.textContent).toBe("Missing data");
    expect(tile("record.general").querySelector('[data-test="section-step-sub"]')!.className).toContain("text-content-muted");
    expect(tile("record.audit").querySelector('[data-test="section-step-sub"]')).toBeNull();
  });

  it("gives the tone of each state", async () => {
    await mountRecord(true, { props: { steps: { "record.general": { done: true, sub: "ok", tone: "positive" }, "record.notes": { done: false, sub: "late", tone: "critical" } } } });
    expect(tile("record.general").querySelector('[data-test="section-step-sub"]')!.className).toContain("text-status-success-content");
    expect(tile("record.notes").querySelector('[data-test="section-step-sub"]')!.className).toContain("text-status-danger-content");
  });

  it("uses the short label on phones and the full one beside it", async () => {
    await mountRecord(false, { props: { steps } });
    const label = tile("record.general").querySelector("span.truncate")!;
    expect([...label.querySelectorAll("span")].map((part) => part.textContent)).toEqual(["General data", "General"]);
  });

  it("the steps are links in any order: choosing one opens its section", async () => {
    const page = await mountRecord(true, { props: { steps } });
    await fireEvent.click(tile("record.audit"));
    await settle();
    expect(page.router.currentRoute.value.name).toBe("record.audit");
    expect(page.content()).toBe("audit content");
    expect(tile("record.audit").getAttribute("aria-current")).toBe("step");
  });

  it("lists the sections of a long form inside a step beside it on wide screens only", async () => {
    await mountRecord(true, { props: { steps }, path: "/records/3/notes" });
    const form = document.querySelector('[data-test="section-steps-form"]')!;
    expect([...form.querySelectorAll('aside [data-test="section-list"] a')].map((link) => link.textContent?.trim())).toEqual(["Identification", "Contact", "Equipment"]);
    expect(form.querySelector("[data-test='section-list']")!.closest("nav")).not.toBeNull();
    document.body.innerHTML = "";
    await mountRecord(false, { props: { steps }, path: "/records/3/notes" });
    expect(document.querySelector('[data-test="section-steps-form"]')).toBeNull();
  });

  it("has no aside beside a step without sections of its own", async () => {
    await mountRecord(true, { props: { steps } });
    expect(document.querySelector('[data-test="section-steps-form"]')).toBeNull();
    expect(document.querySelectorAll("aside")).toHaveLength(0);
  });
});

describe("SectionNavigator as a hub", () => {
  it.each([true, false])("shows no navigation (wide: %s): the first section is the hub, and every other one goes back to it", async (wide) => {
    const page = await mountRecord(wide, { props: { desktop: "hub", compact: "hub", backLabel: "Record 3" }, summary: true });
    expect(page.navigator()?.dataset.variant).toBe("hub");
    expect(page.links()).toEqual([]);
    expect(document.querySelector('[data-test="section-rows"]')).toBeNull();
    expect(page.content()).toBe("general content");
    expect(document.querySelector('[data-test="summary"]')).toBeTruthy();
    expect(page.back.value).toBeNull();

    await page.router.push("/records/3/audit");
    await settle();
    expect(page.content()).toBe("audit content");
    expect(document.querySelector('[data-test="summary"]')).toBeNull();
    expect(page.back.value).toMatchObject({ label: "Record 3" });
  });

  it("lists the sections of a long form inside a hub's section beside it on wide screens only", async () => {
    await mountRecord(true, { props: { desktop: "hub", compact: "hub" }, path: "/records/3/notes" });
    const form = document.querySelector('[data-test="section-steps-form"]')!;
    expect([...form.querySelectorAll('aside [data-test="section-list"] a')].map((link) => link.textContent?.trim())).toEqual(["Identification", "Contact", "Equipment"]);
    document.body.innerHTML = "";
    await mountRecord(false, { props: { desktop: "hub", compact: "hub" }, path: "/records/3/notes" });
    expect(document.querySelector('[data-test="section-steps-form"]')).toBeNull();
  });

  it("can be the hub on one width and a source list on the other", async () => {
    const page = await mountRecord(true, { props: { desktop: "sidebar", compact: "hub" } });
    expect(page.navigator()?.dataset.variant).toBe("sidebar");
    document.body.innerHTML = "";
    const phone = await mountRecord(false, { props: { desktop: "sidebar", compact: "hub" } });
    expect(phone.navigator()?.dataset.variant).toBe("hub");
    expect(phone.links()).toEqual([]);
  });
});
