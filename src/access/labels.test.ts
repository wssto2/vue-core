import { render } from "@testing-library/vue";
import { defineComponent, h } from "vue";
import { describe, expect, it } from "vitest";
import { ApiError } from "../client";
import { createTestI18n } from "../testing/i18n";
import type { PermissionCatalogue } from "./catalogue";
import { accessContextKey } from "./context";
import { useAccessLabels } from "./labels";
import { useRefusalMessage } from "./refusals";

// What arv-next's own useAccessLabels (roleName, scopeLabel, reasonMessage) did, asked of the library's.
const messages = {
  en: {
    access: { roles: { dealeradmin: "Dealer administrator" }, levels: { dealer: "Dealer", location: "Location" } },
    errors: { authz: { dealer_mismatch: "The person belongs to another dealer." } },
  },
};

function inApplication<T>(use: () => T): T {
  let result!: T;
  const context = { catalogue: {} as PermissionCatalogue, problems: { dealer_mismatch: "errors.authz.dealer_mismatch" }, constraints: [], subjectRoute: () => null, scopes: null };
  render(defineComponent({ setup: () => ((result = use()), () => h("p")) }), { global: { plugins: [createTestI18n({ locale: "en", messages })], provide: { [accessContextKey as symbol]: context } } });
  return result;
}

describe("the words arv-next kept its own copy of", () => {
  it("names a predefined role by its key in the app's texts and a custom role by its saved name", () => {
    const { roleName } = inApplication(useAccessLabels);
    expect(roleName({ key: "dealeradmin", name: "Dealer administrator (saved)" })).toBe("Dealer administrator");
    expect(roleName({ key: null, name: "Sales clerk" })).toBe("Sales clerk");
    expect(roleName({ key: "unknown", name: "Fallback" })).toBe("Fallback");
  });

  it("words a place by its level and name, the root by its level alone, a level by the app's text before the library's", () => {
    const { scopeLabel } = inApplication(useAccessLabels);
    expect(scopeLabel({ level: "organization" })).toBe("Organization");
    expect(scopeLabel({ level: "dealer", name: "Auto Zagreb" })).toBe("Dealer · Auto Zagreb");
    expect(scopeLabel({ level: "location", name: "Dubrava" })).toBe("Location · Dubrava");
  });

  it("says a refused delegation by its reason, a problem with a text of its own by that text, and anything else not at all", () => {
    const refusal = inApplication(useRefusalMessage);
    const refused = (code: string, params?: object) => new ApiError({ kind: "forbidden", message: "server text", status: 403, code, ...(params ? { params } : {}) });
    const reasons = ["escalation", "self_assignment", "last_admin", "role_in_use", "invalid", "forbidden"].map((reason) => refusal("failed", refused(`authz.${reason}`)));
    expect(new Set(reasons).size).toBe(6);
    expect(reasons.every((text) => text && text !== "server text")).toBe(true);
    expect(refusal("failed", refused("authz.invalid", { problems: [{ code: "dealer_mismatch" }] }))).toBe("The person belongs to another dealer.");
    expect(refusal("failed", new Error("boom"))).toBeUndefined();
    expect(refusal("failed", refused("iam.reauth_locked"))).toBeUndefined();
  });
});
