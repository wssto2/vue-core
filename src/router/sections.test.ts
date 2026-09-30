import { render } from "@testing-library/vue";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, shallowRef } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter, RouterView, type RouteRecordRaw } from "vue-router";
import { coreMessages } from "../i18n";
import { createAccessClient, platformKey, type AccessSnapshot, type Platform } from "../platform";
import { accessOf, held } from "../platform/testing";
import { useFirstSectionRedirect, useRouteSections, type RouteSections } from "./sections";

const i18n = createI18n({
  legacy: false,
  locale: "en",
  messages: { en: { ...coreMessages.en, record: { general: "General data", general_short: "General", notes: "Notes", audit: "Audit log", group_a: "Record", group_b: "Settings" } } },
});

const settle = async () => {
  for (let index = 0; index < 5; index++) await new Promise((resolve) => setTimeout(resolve, 0));
};
const page = (text: string) => defineComponent({ render: () => h("p", text) });

function routes(): RouteRecordRaw[] {
  return [
    {
      name: "record",
      path: "/records/:recordID",
      component: defineComponent({ render: () => h(RouterView) }),
      children: [
        { name: "record.general", path: "general", component: page("general"), meta: { section: { labelKey: "record.general", shortLabelKey: "record.general_short", icon: "informationLine", groupKey: "record.group_a" } } },
        { name: "record.notes", path: "notes", component: page("notes"), meta: { access: "notes:view", section: { labelKey: "record.notes", icon: "box2Line", groupKey: "record.group_a" } } },
        { name: "record.audit", path: "audit", component: page("audit"), meta: { access: "audit:view", section: { labelKey: "record.audit", icon: "search", groupKey: "record.group_b" } } },
        // a page inside the notes section
        { name: "record.note", path: "notes/:noteID", component: page("note"), meta: { access: "notes:view", sectionParent: "record.notes" } },
        // not a section of the record
        { name: "record.print", path: "print", component: page("print") },
      ],
    },
    { name: "plain", path: "/plain", component: page("plain") },
  ];
}

async function mountAt(path: string, permissions: string[], setup: (sections: RouteSections) => void = () => {}) {
  const snapshot = shallowRef<AccessSnapshot>(accessOf(Object.fromEntries(permissions.map((name) => [name, held("organization", undefined)]))));
  const access = createAccessClient(() => snapshot.value);
  const history = createMemoryHistory();
  const push = vi.spyOn(history, "push");
  const router = createRouter({ history, routes: routes() });
  const captured: { sections?: RouteSections } = {};
  // The record page calls the composables, as SectionNavigator does.
  const tree = router.getRoutes().find((record) => record.name === "record")!;
  tree.components = {
    default: defineComponent({
      setup() {
        captured.sections = useRouteSections();
        setup(captured.sections);
        return () => h(RouterView);
      },
    }),
  };
  await router.push(path);
  const view = render(defineComponent({ render: () => h(RouterView) }), {
    global: { plugins: [router, i18n], provide: { [platformKey as symbol]: { access } as unknown as Platform } },
  });
  await nextTick();
  return {
    ...view,
    router,
    push,
    sections: () => captured.sections!,
    grant: async (...names: string[]) => {
      snapshot.value = accessOf(Object.fromEntries(names.map((name) => [name, held("organization", undefined)])));
      await settle();
    },
  };
}

describe("useRouteSections", () => {
  it("lists the child routes that declare a section, in route order, with translated labels, short labels and groups", async () => {
    const { sections } = await mountAt("/records/3/general", ["notes:view", "audit:view"]);
    expect(sections().sections.value.map((section) => [section.name, section.label, section.shortLabel, section.icon, section.group])).toEqual([
      ["record.general", "General data", "General", "informationLine", "Record"],
      ["record.notes", "Notes", "Notes", "box2Line", "Record"],
      ["record.audit", "Audit log", "Audit log", "search", "Settings"],
    ]);
    expect(sections().declared.value).toBe(3);
    expect(sections().first.value?.name).toBe("record.general");
    expect(sections().active.value?.name).toBe("record.general");
  });

  it("leaves out a section the session may not open, and follows a permission that changes", async () => {
    const page = await mountAt("/records/3/general", ["notes:view"]);
    expect(page.sections().sections.value.map((section) => section.name)).toEqual(["record.general", "record.notes"]);
    expect(page.sections().declared.value).toBe(3);
    await page.grant("notes:view", "audit:view");
    expect(page.sections().sections.value.map((section) => section.name)).toEqual(["record.general", "record.notes", "record.audit"]);
  });

  it("keeps a section active on a page inside it, with links that carry only the params their path declares", async () => {
    const { sections, router } = await mountAt("/records/3/general?from=list", ["notes:view"]);
    expect(sections().subPage.value).toBe(false);
    expect(sections().sections.value[1]?.to).toEqual({ name: "record.notes", params: { recordID: "3" }, query: { from: "list" } });

    await router.push("/records/3/notes/9");
    expect(sections().active.value?.name).toBe("record.notes");
    expect(sections().subPage.value).toBe(true);
    expect(sections().sections.value[1]?.to).toEqual({ name: "record.notes", params: { recordID: "3" }, query: {} });
  });

  it("knows the record's bare URL, and a section the session may not open", async () => {
    const page = await mountAt("/records/3", ["notes:view"]);
    expect(page.sections().bare.value).toBe(true);
    expect(page.sections().denied.value).toBe(false);

    await page.router.push("/records/3/audit");
    expect(page.sections().bare.value).toBe(false);
    expect(page.sections().denied.value).toBe(true);

    await page.router.push("/records/3/print");
    expect(page.sections().denied.value).toBe(false);
    expect(page.sections().active.value).toBeNull();
  });
});

describe("useFirstSectionRedirect", () => {
  const redirecting = (sections: RouteSections) => useFirstSectionRedirect(sections);

  it("moves the bare record URL to the first section the session may open", async () => {
    const { router } = await mountAt("/records/3", ["notes:view"], redirecting);
    await settle();
    expect(router.currentRoute.value.name).toBe("record.general");
    expect(router.currentRoute.value.params.recordID).toBe("3");
  });

  it("moves a direct link to a section the session may not open, and replaces the entry instead of adding one", async () => {
    const { router, push } = await mountAt("/records/3/audit", ["notes:view"], redirecting);
    await settle();
    expect(router.currentRoute.value.name).toBe("record.general");
    expect(push).not.toHaveBeenCalled(); // replaced, nothing added to the history
  });

  it("follows a permission taken away while the section is open, and leaves an accessible one alone", async () => {
    const page = await mountAt("/records/3/notes", ["notes:view"], redirecting);
    await settle();
    expect(page.router.currentRoute.value.name).toBe("record.notes");
    await page.grant();
    expect(page.router.currentRoute.value.name).toBe("record.general");
  });

  it("moves away from a section whose permission was taken away even when the number of sections stays the same (ARV re-checked only when the count changed)", async () => {
    const page = await mountAt("/records/3/notes", ["notes:view"], redirecting);
    await settle();
    expect(page.sections().sections.value.map((section) => section.name)).toEqual(["record.general", "record.notes"]);
    await page.grant("audit:view"); // notes revoked, audit granted: still two sections
    expect(page.sections().sections.value.map((section) => section.name)).toEqual(["record.general", "record.audit"]);
    expect(page.router.currentRoute.value.name).toBe("record.general");
  });

  it("does not move a route that is not a section, and stays put when the session may open no section at all (no loop)", async () => {
    const plain = await mountAt("/records/3/print", [], redirecting);
    await settle();
    expect(plain.router.currentRoute.value.name).toBe("record.print");

    // Every section denied: nothing to move to.
    const none = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: "/r/:id",
          component: defineComponent({ render: () => h(RouterView) }),
          children: [{ name: "only", path: "only", component: page("only"), meta: { access: "x:view", section: { labelKey: "record.notes", icon: "box2Line" } } }],
        },
      ],
    });
    const navigations: string[] = [];
    none.afterEach((to) => void navigations.push(to.fullPath));
    const access = createAccessClient(() => accessOf({}));
    const tree = none.getRoutes()[0]!;
    tree.components = { default: defineComponent({ setup() { const sections = useRouteSections(); useFirstSectionRedirect(sections); return () => h(RouterView); } }) };
    await none.push("/r/1/only");
    render(defineComponent({ render: () => h(RouterView) }), { global: { plugins: [none, i18n], provide: { [platformKey as symbol]: { access } as unknown as Platform } } });
    await settle();
    expect(navigations).toEqual(["/r/1/only"]);
  });
});
