import { render } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, shallowRef } from "vue";
import { createMemoryHistory, createRouter, RouterView, type RouteRecordRaw } from "vue-router";
import { createAccessClient, type AccessSnapshot } from "../platform";
import { accessOf, held } from "../platform/testing";
import { AppRouterView, createRouteAccess, firstDenied, routeAccessKey } from "./access";

const text = (label: string) => defineComponent({ render: () => h("p", label) });
const layout = (label: string) => defineComponent({ render: () => h("section", [h("h1", label), h(AppRouterView)]) });

const routes: RouteRecordRaw[] = [
  { name: "open", path: "/open", component: text("open page") },
  { name: "secret", path: "/secret", component: text("secret page"), meta: { access: "secret:view" } },
  {
    name: "records",
    path: "/records",
    component: layout("records layout"),
    meta: { access: "records:view" },
    children: [{ name: "records.edit", path: "edit", component: text("edit page"), meta: { access: "records:update" } }],
  },
  {
    path: "/mixed",
    component: layout("mixed layout"),
    children: [
      { name: "mixed.any", path: "any", component: text("any page"), meta: { access: { any: ["a:view", "b:view"] } } },
      { name: "mixed.all", path: "all", component: text("all page"), meta: { access: { all: ["a:view", "b:view"] } } },
    ],
  },
  { name: "record", path: "/record/:id", component: text("record page"), meta: { remountOnParam: "id" } },
];

async function mountAt(path: string, permissions: string[]) {
  const snapshot = shallowRef<AccessSnapshot>(accessOf(Object.fromEntries(permissions.map((permission) => [permission, held("organization", undefined)]))));
  const access = createAccessClient(() => snapshot.value);
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push(path);
  const routeAccess = createRouteAccess({ router, access, noAccess: text("NO ACCESS") });
  const view = render(defineComponent({ render: () => h(AppRouterView) }), {
    global: { plugins: [router], provide: { [routeAccessKey as symbol]: routeAccess } },
  });
  return { ...view, router, snapshot, grant: async (...names: string[]) => { snapshot.value = accessOf(Object.fromEntries(names.map((permission) => [permission, held("organization", undefined)]))); await nextTick(); } };
}

describe("firstDenied", () => {
  it("is the index of the first record the session may not open", async () => {
    const router = createRouter({ history: createMemoryHistory(), routes });
    await router.push("/records/edit");
    const can = (held: string[]) => createAccessClient(() => accessOf(Object.fromEntries(held.map((name) => [name, { scope: { level: "organization" }, qualifier: "all" as const, clauses: [] }]))));

    expect(firstDenied(router.currentRoute.value, can([]))).toBe(0);
    expect(firstDenied(router.currentRoute.value, can(["records:view"]))).toBe(1);
    expect(firstDenied(router.currentRoute.value, can(["records:view", "records:update"]))).toBe(-1);
  });
});

describe("AppRouterView", () => {
  it("renders a page that needs nothing, and one the session holds the permission for", async () => {
    expect((await mountAt("/open", [])).container.textContent).toBe("open page");
    expect((await mountAt("/secret", ["secret:view"])).container.textContent).toBe("secret page");
  });

  it("shows the no-access state in place of a page the session may not open, without leaving the URL", async () => {
    const { container, router } = await mountAt("/secret", []);

    expect(container.textContent).toBe("NO ACCESS");
    expect(router.currentRoute.value.fullPath).toBe("/secret");
  });

  it("follows a permission refresh at once, without a navigation", async () => {
    const { container, grant } = await mountAt("/secret", []);
    expect(container.textContent).toBe("NO ACCESS");

    await grant("secret:view");
    expect(container.textContent).toBe("secret page");
    await grant();
    expect(container.textContent).toBe("NO ACCESS");
  });

  it("a denied ancestor denies every child; a denied child leaves the parent layout in place", async () => {
    const parentDenied = await mountAt("/records/edit", []);
    expect(parentDenied.container.textContent).toBe("NO ACCESS"); // the layout is denied, so is everything in it

    const childDenied = await mountAt("/records/edit", ["records:view"]);
    expect(childDenied.container.textContent).toBe("records layoutNO ACCESS");

    const allowed = await mountAt("/records/edit", ["records:view", "records:update"]);
    expect(allowed.container.textContent).toBe("records layoutedit page");
  });

  it("`any` needs one of the permissions, `all` needs every one", async () => {
    expect((await mountAt("/mixed/any", ["b:view"])).container.textContent).toBe("mixed layoutany page");
    expect((await mountAt("/mixed/any", [])).container.textContent).toBe("mixed layoutNO ACCESS");
    expect((await mountAt("/mixed/all", ["a:view"])).container.textContent).toBe("mixed layoutNO ACCESS");
    expect((await mountAt("/mixed/all", ["a:view", "b:view"])).container.textContent).toBe("mixed layoutall page");
  });

  it("remounts the page when the parameter named by meta.remountOnParam changes", async () => {
    let created = 0;
    const counted = defineComponent({ setup() { created++; return () => h("p", "record"); } });
    const router = createRouter({ history: createMemoryHistory(), routes: [{ name: "record", path: "/record/:id", component: counted, meta: { remountOnParam: "id" } }, { name: "plain", path: "/plain/:id", component: counted }] });
    await router.push("/record/1");
    render(defineComponent({ render: () => h(AppRouterView) }), {
      global: { plugins: [router], provide: { [routeAccessKey as symbol]: createRouteAccess({ router, access: createAccessClient(() => null), noAccess: text("NO") }) } },
    });

    await router.push("/record/2");
    await router.push("/record/3");
    expect(created).toBe(3);

    await router.push("/plain/1");
    await router.push("/plain/2"); // no remountOnParam: the instance is reused
    expect(created).toBe(4);
  });

  it("a bare RouterView is not affected (denial is shown by AppRouterView only)", async () => {
    const router = createRouter({ history: createMemoryHistory(), routes });
    await router.push("/secret");
    const { container } = render(defineComponent({ render: () => h(RouterView) }), { global: { plugins: [router] } });
    expect(container.textContent).toBe("secret page");
  });
});
