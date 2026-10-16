import { describe, expect, it } from "vitest";
import { z } from "zod";
import { hasUnsupportedCharacters, refineStorableText, unsupportedCharactersCode } from "./storableText";

describe("storable text", () => {
  it("flags 4-byte characters", () => {
    expect(hasUnsupportedCharacters("super 🚗")).toBe(true);
    expect(hasUnsupportedCharacters("👍🏽")).toBe(true);
    expect(hasUnsupportedCharacters("𠮷野家")).toBe(true); // supplementary CJK
    expect(hasUnsupportedCharacters("\u{10000}")).toBe(true); // first supplementary code point
    expect(hasUnsupportedCharacters("\u{10FFFF}")).toBe(true); // last
  });

  it("passes what a utf8mb3 column stores", () => {
    expect(hasUnsupportedCharacters("Čćžšđ ČĆŽŠĐ")).toBe(false);
    expect(hasUnsupportedCharacters("野家 ‮ ￿ UU1DJF00577271850")).toBe(false);
    expect(hasUnsupportedCharacters("")).toBe(false);
  });

  it("does not flag a lone surrogate, only a pair", () => {
    expect(hasUnsupportedCharacters("\uD83D")).toBe(false);
    expect(hasUnsupportedCharacters("\uDE80")).toBe(false);
    expect(hasUnsupportedCharacters("\uDE80\uD83D")).toBe(false); // reversed order
    expect(hasUnsupportedCharacters("🚀")).toBe(true);
    expect(hasUnsupportedCharacters("a🚀b")).toBe(true);
  });

  it("reports each offending string on its own path", () => {
    const schema = z
      .object({ name: z.string(), count: z.number(), vehicles: z.array(z.object({ note: z.string() })) })
      .superRefine(refineStorableText);

    const result = schema.safeParse({ name: "🚗", count: 1, vehicles: [{ note: "ok" }, { note: "🔥" }] });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(["name", "vehicles.1.note"]);
    expect(result.error?.issues[0]).toMatchObject({ code: "custom", params: { code: unsupportedCharactersCode } });
    expect(schema.safeParse({ name: "Čćž", count: 1, vehicles: [] }).success).toBe(true);
    expect(schema.safeParse({ name: "", count: 0, vehicles: [{ note: "" }] }).success).toBe(true);
  });

  it("walks a bare string and an array at the root", () => {
    const issues: unknown[] = [];
    refineStorableText("🚗", { addIssue: (issue) => issues.push(issue) });
    refineStorableText(["a", "b🚗"], { addIssue: (issue) => issues.push(issue) });
    expect(issues).toEqual([
      { code: "custom", path: [], params: { code: "unsupported_characters" } },
      { code: "custom", path: [1], params: { code: "unsupported_characters" } },
    ]);
  });
});
