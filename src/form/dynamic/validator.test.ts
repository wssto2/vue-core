import { describe, expect, it } from "vitest";
import * as zod from "zod";
import { buildValidator } from "./validator";
import type { FormSchema } from "./schema";

const schema: FormSchema = {
  fields: [
    { key: "main_heading", kind: "text", label: "Heading", required: true },
    { key: "video_url", kind: "text", label: "Video", validation: [{ rule: "max", args: [10] }, { rule: "url" }] },
    { key: "email", kind: "text", label: "E-mail", validation: [{ rule: "email" }] },
    { key: "code", kind: "text", label: "Code", validation: [{ rule: "regex", args: ["^[A-Z]{3}$"] }, { rule: "min", args: [3] }] },
    { key: "year", kind: "number", label: "Year", validation: [{ rule: "min", args: [1900] }, { rule: "max", args: [2100] }] },
    { key: "replied", kind: "boolean", label: "Replied" },
    { key: "replied_at", kind: "date", label: "At", required: true, visible_when: { all: [{ field: "replied", eq: true }] } },
    { key: "kind", kind: "select", label: "Kind", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] },
    { key: "tags", kind: "multi_select", label: "Tags", options: [{ value: 1, label: "One" }], validation: [{ rule: "max", args: [2] }] },
    { key: "image", kind: "image", label: "Image", required: true },
    { key: "gallery", kind: "gallery", label: "Gallery" },
    { key: "title", kind: "text", label: "Title", translatable: true, required: true, validation: [{ rule: "max", args: [8] }] },
    { key: "slike", kind: "collection", label: "Slike", validation: [{ rule: "max", args: [2] }], children: [{ key: "caption", kind: "text", label: "Caption", required: true }, { key: "alt", kind: "text", label: "Alt", visible_when: { all: [{ field: "caption", eq: "x" }] }, validation: [{ rule: "max", args: [1] }] }] },
  ],
};
const valid = { main_heading: "Hi", image: 3, title: { hr: "Naslov" } };
const validator = buildValidator(schema, { zod });
const problems = (input: unknown) => {
  const result = validator.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}`);
};

describe("buildValidator", () => {
  it("accepts a valid value and returns the visible fields, not unknown keys", () => {
    const result = validator.safeParse({ ...valid, junk: 1, replied: false, replied_at: "garbage" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ main_heading: "Hi", image: 3 });
      expect(result.data).not.toHaveProperty("junk");
      expect(result.data).not.toHaveProperty("replied_at");
    }
  });

  it("requires what is required: empty text, a missing id, a translatable text with nothing written", () => {
    expect(problems({ main_heading: "  ", title: { hr: "", en: "" } })).toEqual(["main_heading", "image", "title"]);
  });

  it("checks the type of each kind", () => {
    expect(problems({ ...valid, year: "2020", kind: "c", tags: [2], gallery: [{}], replied: "yes" })).toEqual(["year", "replied", "kind", "tags", "gallery.0"]);
  });

  it("checks min and max: a text's length, a number's value, a list's size", () => {
    expect(problems({ ...valid, code: "AB", year: 1800, tags: [1, 1, 1], title: { hr: "too long text" } })).toEqual(["code", "code", "year", "tags", "title.hr"]);
    expect(problems({ ...valid, year: 2100 })).toEqual([]);
  });

  it("checks email, url and regex", () => {
    expect(problems({ ...valid, email: "nope", video_url: "nope", code: "abc" })).toEqual(["video_url", "email", "code"]);
    expect(problems({ ...valid, email: "a@b.hr", video_url: "http://a.h", code: "ABC" })).toEqual([]);
  });

  it("skips a hidden field: not required, not validated; checks it once visible", () => {
    expect(problems({ ...valid, replied: false })).toEqual([]);
    expect(problems({ ...valid, replied: true })).toEqual(["replied_at"]);
    expect(problems({ ...valid, replied: true, replied_at: "2026-02-30" })).toEqual(["replied_at"]);
    expect(problems({ ...valid, replied: true, replied_at: "2026-02-03" })).toEqual([]);
  });

  it("validates each row of a collection by its path, with the row's own visible_when", () => {
    expect(problems({ ...valid, slike: [{ caption: "" }, { caption: "x", alt: "too long" }, { caption: "y", alt: "ignored, hidden" }] })).toEqual(["slike", "slike.0.caption", "slike.1.alt"]);
  });

  it("uses the texts it is given, else Zod's (which zodErrorMap words)", () => {
    const worded = buildValidator(schema, { zod, messages: { required: "Fill this in", email: "Not an e-mail" } });
    const result = worded.safeParse({ email: "x", image: 1, title: { hr: "a" } });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => issue.message)).toEqual(["Fill this in", "Not an e-mail"]);
  });

  it("needs the default language of a required translatable text when it is told which", () => {
    const strict = buildValidator(schema, { zod, defaultLocale: "hr" });
    expect(strict.safeParse({ main_heading: "x", image: 1, title: { en: "Title" } }).success).toBe(false);
    expect(strict.safeParse({ main_heading: "x", image: 1, title: { hr: "Naslov" } }).success).toBe(true);
  });

  it("refuses a rule that is worded wrongly when it is built", () => {
    expect(() => buildValidator({ fields: [{ key: "a", kind: "text", label: "A", validation: [{ rule: "max" }] }] }, { zod })).toThrow(/number argument/);
    expect(() => buildValidator({ fields: [{ key: "a", kind: "text", label: "A", validation: [{ rule: "regex" }] }] }, { zod }).safeParse({ a: "x" })).toThrow(/pattern/);
  });
});
