import { describe, expect, it } from "vitest";
import { authorOf, type ResourceAuthor } from "./authors";

const ana: ResourceAuthor = { id: 7, name: "Ana", email: null, phone_number: null, avatar: null, active: true };

describe("authorOf", () => {
  it("is a ResourceAuthor by default even inside another call's argument", () => {
    const nameOf = (person: { readonly name: string } | null) => person?.name ?? null;
    expect(nameOf(authorOf({ authors: [ana] }, ana.id))).toBe(ana.name);
  });

  it("finds the author of an id in a list's meta.authors", () => {
    expect(authorOf({ authors: [{ ...ana, id: 3 }, ana] }, 7)).toBe(ana);
  });

  it("is null for no id, no meta, no authors, or an id nobody has", () => {
    expect(authorOf({ authors: [ana] }, null)).toBeNull();
    expect(authorOf({ authors: [ana] }, undefined)).toBeNull();
    expect(authorOf(null, 7)).toBeNull();
    expect(authorOf(undefined, 7)).toBeNull();
    expect(authorOf({}, 7)).toBeNull();
    expect(authorOf({ authors: "ana" }, 7)).toBeNull();
    expect(authorOf({ authors: [ana] }, 8)).toBeNull();
  });

  it("returns the app's own author type", () => {
    const found = authorOf<ResourceAuthor & { role: string }>({ authors: [{ ...ana, role: "admin" }] }, 7);
    expect(found?.role).toBe("admin");
  });
});
