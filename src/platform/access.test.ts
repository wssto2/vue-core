import { describe, expect, it } from "vitest";
import { createAccessClient, parseAccessSnapshot, type AccessSnapshot } from "./access";
import { accessOf, held } from "./testing";

const clientFor = (snapshot: AccessSnapshot | null, covers?: Parameters<typeof createAccessClient>[1]) =>
  createAccessClient(() => snapshot, covers);

describe("can / canAny / canAll / held", () => {
  const access = clientFor(
    accessOf(
      { "crm.lead:view": held("dealer", 10, "own_location"), "crm.offer:view": held("organization", undefined, "all") },
      { unavailable: ["crm.contract:view"], root: true },
    ),
  );

  it("holds what the snapshot lists, and nothing else", () => {
    expect(access.can("crm.lead:view")).toBe(true);
    expect(access.can("crm.customer:view")).toBe(false);
    expect(access.root).toBe(true);
  });

  it("answers for any / all, with the vacuous cases explicit", () => {
    expect(access.canAny(["crm.customer:view", "crm.offer:view"])).toBe(true);
    expect(access.canAny([])).toBe(false);
    expect(access.canAll(["crm.lead:view", "crm.offer:view"])).toBe(true);
    expect(access.canAll(["crm.lead:view", "x"])).toBe(false);
    expect(access.canAll([])).toBe(true);
  });

  it("reports how a permission is held: widest scope and qualifier; null when not held", () => {
    expect(access.held("crm.lead:view")).toMatchObject({ scope: { level: "dealer", id: 10 }, qualifier: "own_location" });
    expect(access.held("crm.customer:view")).toBeNull();
  });

  it("does not hold a permission switched off for the tenant, even if listed", () => {
    const off = clientFor(accessOf({ "crm.lead:view": held("organization", undefined) }, { unavailable: ["crm.lead:view"] }));
    expect(off.can("crm.lead:view")).toBe(false);
    expect(off.held("crm.lead:view")).toBeNull();
  });

  it("holds nothing without a snapshot", () => {
    const none = clientFor(null);
    expect(none.can("crm.lead:view")).toBe(false);
    expect(none.root).toBe(false);
  });

  it("does not see Object.prototype members as permissions (ARV's `in` check held 'constructor')", () => {
    for (const name of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
      expect(access.can(name)).toBe(false);
      expect(access.held(name)).toBeNull();
    }
  });
});

describe("can with a scope", () => {
  const snapshot = accessOf({
    "iam.user:view": held("dealer", 10, "all", [
      { scope: { level: "dealer", id: 10 }, qualifier: "all" },
      { scope: { level: "location", id: 101 }, qualifier: "own" },
    ]),
  });

  it("matches a clause's scope exactly by default", () => {
    const access = clientFor(snapshot);
    expect(access.can("iam.user:view", { level: "dealer", id: 10 })).toBe(true);
    expect(access.can("iam.user:view", { level: "location", id: 101 })).toBe(true);
    expect(access.can("iam.user:view", { level: "location", id: 102 })).toBe(false);
    expect(access.can("iam.user:view", { level: "dealer", id: 11 })).toBe(false);
  });

  it("uses the application's containment when it supplies one", () => {
    const parent: Record<string, number> = { "location:102": 10 }; // location 102 is in dealer 10
    const access = clientFor(snapshot, {
      covers: (heldScope, asked) =>
        (heldScope.level === asked.level && heldScope.id === asked.id) ||
        (heldScope.level === "dealer" && asked.level === "location" && parent[`location:${asked.id}`] === heldScope.id),
    });
    expect(access.can("iam.user:view", { level: "location", id: 102 })).toBe(true);
    expect(access.can("iam.user:view", { level: "location", id: 999 })).toBe(false);
  });

  it("falls back to the widest scope when a payload has no clauses", () => {
    const access = clientFor(accessOf({ p: { scope: { level: "dealer", id: 1 }, qualifier: "all", clauses: [] } }));
    expect(access.can("p", { level: "dealer", id: 1 })).toBe(true);
  });
});

describe("parseAccessSnapshot", () => {
  it("reads go-core's payload", () => {
    const { snapshot, issues } = parseAccessSnapshot({
      subject: { kind: "user", id: 1 },
      root: true,
      permissions: {
        "crm.lead:view": {
          scope: { level: "dealer", id: 10 },
          qualifier: "own_location",
          clauses: [{ scope: { level: "dealer", id: 10 }, qualifier: "own_location", role: "sales", binding_id: 4, attrs: { a: ["b"] } }],
        },
      },
      unavailable: ["x"],
    });
    expect(issues).toEqual([]);
    expect(snapshot.root).toBe(true);
    expect(snapshot.unavailable).toEqual(["x"]);
    expect(snapshot.permissions["crm.lead:view"]?.clauses[0]).toEqual({ scope: { level: "dealer", id: 10 }, qualifier: "own_location", role: "sales" });
  });

  it("names every problem", () => {
    const { issues } = parseAccessSnapshot({
      permissions: { a: { scope: { id: 1 }, qualifier: "some", clauses: [{ scope: { level: "x" }, qualifier: "all" }, 4] }, b: 3 },
      unavailable: [1],
    });
    expect(issues).toEqual([
      "access.permissions.a.clauses[1]: expected an object",
      "access.permissions.a.scope: expected { level: string, id?: number }",
      "access.permissions.a.qualifier: expected one of own, own_location, all",
      "access.permissions.b: expected an object",
      "access.unavailable: expected an array of strings",
    ]);
    expect(parseAccessSnapshot(null).issues).toEqual(["access: expected an object"]);
    expect(parseAccessSnapshot({}).issues).toEqual(["access.permissions: expected an object"]);
  });
});
