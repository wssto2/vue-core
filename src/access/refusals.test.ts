import { render } from "@testing-library/vue";
import { defineComponent, h } from "vue";
import { describe, expect, it } from "vitest";
import { ApiError } from "../client";
import { describeErrorWith } from "../i18n/describeError";
import { createTestI18n } from "../testing/i18n";
import type { PermissionCatalogue } from "./catalogue";
import { accessContextKey } from "./context";
import { roleProblems, useDescribeRefusal } from "./refusals";

const REASONS = ["escalation", "self_assignment", "last_admin", "role_in_use", "forbidden", "invalid"] as const;

describe("the refusals of go-core's delegation rules", () => {
  it("are said in every language, each reason in its own words, and the app can say it otherwise", () => {
    const said = new Map<string, string[]>();
    for (const locale of ["en", "hr", "bs", "sl", "sr-Latn"] as const) {
      const i18n = createTestI18n({ locale });
      const describe = describeErrorWith({ t: (key, params) => i18n.global.t(key, params ?? {}) as string, te: (key) => i18n.global.te(key) });
      const sentences = REASONS.map((reason) => describe(new ApiError({ kind: "forbidden", status: 403, code: `authz.${reason}`, message: "server text" })));
      expect(new Set(sentences).size).toBe(REASONS.length);
      expect(sentences.every((sentence) => sentence !== "server text" && sentence.length > 10)).toBe(true);
      said.set(locale, sentences);
    }
    // a translation that was never made would repeat the English one
    for (const locale of ["hr", "bs", "sl", "sr-Latn"]) for (const [index, sentence] of (said.get(locale) ?? []).entries()) expect(sentence).not.toBe(said.get("en")?.[index]);

    const i18n = createTestI18n({ locale: "en", messages: { en: { errors: { authz: { escalation: "Ask an administrator." } } } } });
    const describe = describeErrorWith({ t: (key, params) => i18n.global.t(key, params ?? {}) as string, te: (key) => i18n.global.te(key) });
    expect(describe(new ApiError({ kind: "forbidden", status: 403, code: "authz.escalation", message: "x" }))).toBe("Ask an administrator.");
  });
});

describe("a role refused as invalid (go-core v1.8.0 authz.invalid)", () => {
  // The shape go-core sends: problems as objects, empty fields omitted, sorted by code then permission.
  const invalid = (problems: unknown) => new ApiError({ kind: "validation", status: 400, code: "authz.invalid", message: "server text", params: { problems } });
  const sample = [{ code: "organization_only", permission: "crm.lead:view" }, { code: "vehicle_kind_conflict", permission: "crm.customer:update", detail: "new only" }, { code: "not_a_code" }];

  it("reads the problems and ignores any other error", () => {
    expect(roleProblems(invalid(sample))).toEqual(sample);
    expect(roleProblems(invalid([{ nonsense: true }, "text", null]))).toEqual([]);
    expect(roleProblems(new ApiError({ kind: "forbidden", status: 403, code: "authz.forbidden", message: "x", params: { problems: sample } }))).toEqual([]);
  });

  it("says one sentence per problem: the library's for its codes, the app's for its own, the permission label in them", async () => {
    let said = "";
    const Probe = defineComponent({
      setup() {
        said = useDescribeRefusal()(invalid(sample));
        return () => h("p");
      },
    });
    const messages = { en: { roles: { vk: "{permission} conflicts with the vehicle kind ({detail})." }, perm: { lead: "View leads" } } };
    const catalogueOf = { "crm.lead:view": { labelKey: "perm.lead" } } as unknown as PermissionCatalogue;
    const i18n = createTestI18n({ locale: "en", messages });
    render(Probe, { global: { plugins: [i18n], provide: { [accessContextKey as symbol]: { catalogue: catalogueOf, problems: { vehicle_kind_conflict: "roles.vk" }, subjectRoute: () => null, scopes: null } } } });
    expect(said).toBe("View leads can only be given for the whole organization. crm.customer:update conflicts with the vehicle kind (new only). The role is not valid (not_a_code).");
  });
});
