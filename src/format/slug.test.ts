import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("folds diacritics and joins words with hyphens", () => {
    expect(slugify("Stanje i boja")).toBe("stanje-i-boja");
    expect(slugify("Smanjenje / povećanje vrijednosti")).toBe("smanjenje-povecanje-vrijednosti");
    expect(slugify("Đurđevac – čćšž")).toBe("durdevac-ccsz");
    expect(slugify("Škoda Octavia 2.0 TDI")).toBe("skoda-octavia-2-0-tdi");
  });

  it("returns an empty string when nothing is left", () => {
    expect(slugify(" / ")).toBe("");
    expect(slugify("")).toBe("");
  });
});
