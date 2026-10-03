import { describe, expect, it } from "vitest";
import { ApiError } from "../client";
import { describeErrorWith } from "../i18n/describeError";
import { createTestI18n } from "../testing/i18n";

const REASONS = ["escalation", "self_assignment", "last_admin", "role_in_use", "forbidden", "invalid"] as const;

describe("the refusals of go-core's delegation rules", () => {
  it("are said in every language, each reason in its own words, and the app can say it otherwise", () => {
    const said = new Map<string, string[]>();
    for (const locale of ["en", "hr", "bs", "sl"] as const) {
      const i18n = createTestI18n({ locale });
      const describe = describeErrorWith({ t: (key, params) => i18n.global.t(key, params ?? {}) as string, te: (key) => i18n.global.te(key) });
      const sentences = REASONS.map((reason) => describe(new ApiError({ kind: "forbidden", status: 403, code: `authz.${reason}`, message: "server text" })));
      expect(new Set(sentences).size).toBe(REASONS.length);
      expect(sentences.every((sentence) => sentence !== "server text" && sentence.length > 10)).toBe(true);
      said.set(locale, sentences);
    }
    // a translation that was never made would repeat the English one
    for (const locale of ["hr", "bs", "sl"]) for (const [index, sentence] of (said.get(locale) ?? []).entries()) expect(sentence).not.toBe(said.get("en")?.[index]);

    const i18n = createTestI18n({ locale: "en", messages: { en: { errors: { authz: { escalation: "Ask an administrator." } } } } });
    const describe = describeErrorWith({ t: (key, params) => i18n.global.t(key, params ?? {}) as string, te: (key) => i18n.global.te(key) });
    expect(describe(new ApiError({ kind: "forbidden", status: 403, code: "authz.escalation", message: "x" }))).toBe("Ask an administrator.");
  });
});
