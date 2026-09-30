import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { defineRoutes, isAllowed } from "./index";
import { createAccessClient } from "../platform";
import { accessOf, held } from "../platform/testing";

const view = { render: () => null };

describe("defineRoutes", () => {
  const routes = defineRoutes({
    index: { name: "tickets.index", path: "/tickets", component: view },
    record: {
      name: "tickets.record",
      path: "/tickets/:ticketID",
      component: view,
      children: [{ name: "tickets.general", path: "general", component: view }],
    },
    search: { name: "tickets.search", path: "/search/:term?", component: view },
  });

  it("hands ordinary records to the router and gives targets that resolve to the same paths", () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [...routes.records] });

    expect(routes.records.map((record) => record.name)).toEqual(["tickets.index", "tickets.record", "tickets.search"]);
    expect(router.resolve(routes.index).fullPath).toBe("/tickets");
    expect(router.resolve(routes.record({ ticketID: 12 })).fullPath).toBe("/tickets/12");
    expect(router.resolve({ name: "tickets.general", params: { ticketID: 3 } }).fullPath).toBe("/tickets/3/general");
    expect(router.resolve(routes.search()).fullPath).toBe("/search");
    expect(router.resolve(routes.search({ term: "a b" })).fullPath).toBe("/search/a%20b");
  });

  it("a target is a plain location a caller can extend", () => {
    expect({ ...routes.index, query: { page: "2" } }).toEqual({ name: "tickets.index", query: { page: "2" } });
    expect({ ...routes.record({ ticketID: 1 }), hash: "#x" }).toEqual({ name: "tickets.record", params: { ticketID: 1 }, hash: "#x" });
  });

  it("rejects a name used twice in one declaration, nested ones included", () => {
    expect(() =>
      defineRoutes({
        a: { name: "x", path: "/a", component: view },
        b: { name: "y", path: "/b", component: view, children: [{ name: "x", path: "c", component: view }] },
      }),
    ).toThrow(/route name "x" is used twice/);
  });
});

describe("isAllowed", () => {
  const access = createAccessClient(() => accessOf({ "a:view": held("organization", undefined), "b:view": held("organization", undefined) }));

  it("one permission, any of several, all of several; no requirement is open", () => {
    expect(isAllowed(undefined, access)).toBe(true);
    expect(isAllowed("a:view", access)).toBe(true);
    expect(isAllowed("c:view", access)).toBe(false);
    expect(isAllowed({ any: ["c:view", "b:view"] }, access)).toBe(true);
    expect(isAllowed({ any: ["c:view"] }, access)).toBe(false);
    expect(isAllowed({ all: ["a:view", "b:view"] }, access)).toBe(true);
    expect(isAllowed({ all: ["a:view", "c:view"] }, access)).toBe(false);
    expect(isAllowed({ any: [] }, access)).toBe(false);
  });
});
