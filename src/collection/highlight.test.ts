import { describe, expect, it } from "vitest";
import { highlightParts } from "./highlight";

describe("highlightParts", () => {
  it("splits around every word of the search, any case", () => {
    expect(highlightParts("Ada Lovelace", "ada LOVE")).toEqual([
      { text: "Ada", match: true },
      { text: " ", match: false },
      { text: "Love", match: true },
      { text: "lace", match: false },
    ]);
  });

  it("is one part when there is no search or no match", () => {
    for (const search of [undefined, null, "", "  ", "zzz"]) expect(highlightParts("Ada", search)).toEqual([{ text: "Ada", match: false }]);
    expect(highlightParts("", "a")).toEqual([{ text: "", match: false }]);
  });

  it("takes a special character literally and the longer word first", () => {
    expect(highlightParts("a.b (x)", "(x) a.b")).toEqual([{ text: "a.b", match: true }, { text: " ", match: false }, { text: "(x)", match: true }]);
    expect(highlightParts("Annabel", "an ann")).toEqual([{ text: "Ann", match: true }, { text: "abel", match: false }]);
  });

  it("does not fold accents (as the ARV highlight did)", () => {
    expect(highlightParts("Čačić", "cacic")).toEqual([{ text: "Čačić", match: false }]);
  });
});
