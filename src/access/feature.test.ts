import { describe, expect, it } from "vitest";
import { accessFeature } from "./feature";
import { accessPages, personRolesSection } from "./routes";
import { catalogue } from "./testing";

describe("accessFeature", () => {
  it("installs the roles pages, each behind the permission go-core guards it with", () => {
    const feature = accessFeature({ catalogue });
    expect(feature.id).toBe("access");
    expect(Object.fromEntries(feature.routes.map((route) => [route.name, route.meta?.access]))).toEqual({
      "access.roles": "iam.role:view",
      "access.roles.new": "iam.role:manage",
      "access.role": "iam.role:view",
    });
    // "new" is declared before ":ref", so it is never read as a role's ref
    expect(feature.routes.map((route) => route.path)).toEqual(["/iam/roles", "/iam/roles/new", "/iam/roles/:ref"]);
  });

  it("binds the backend's menu entry for the roles list only when the application names it", () => {
    expect(accessFeature({ catalogue }).navigation).toEqual([]);
    const [binding] = accessFeature({ catalogue, destination: "iam.roles" }).navigation;
    expect(binding).toEqual({ destination: "iam.roles", to: accessPages.roles, within: ["access.role", "access.roles.new"] });
  });

  it("offers a person's record the section meta for its roles", () => {
    expect(personRolesSection.access).toBe("iam.user:view");
    expect(personRolesSection.section.icon).toBe("shieldStarFill");
  });
});
