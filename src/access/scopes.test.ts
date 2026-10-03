import { describe, expect, it } from "vitest";
import type { ScopeOption, ScopeOptions } from "../modules/access/entities";
import { defaultLevel, placesAt, scopeLevels } from "./scopes";

const place = (level: string, id: number, name: string, parent: [string, number | null]): ScopeOption => ({ level, id, name, parent_level: parent[0], parent_id: parent[1] });

// organization > dealer > location; dealer 3 has two locations, dealer 4 none
const options: ScopeOptions = {
  root: true,
  places: [place("dealer", 3, "Auto Zagreb", ["organization", null]), place("dealer", 4, "Auto Split", ["organization", null]), place("location", 7, "Zagreb Sjever", ["dealer", 3]), place("location", 8, "Zagreb Jug", ["dealer", 3])],
};

describe("scopeLevels", () => {
  it("lists the levels narrowest first with their chains, the root last", () => {
    expect(scopeLevels(options, "organization")).toEqual([
      { level: "location", chain: ["dealer", "location"] },
      { level: "dealer", chain: ["dealer"] },
      { level: "organization", chain: [] },
    ]);
  });

  it("leaves the root out when roles may not be given there, and has only the root for an application with one level", () => {
    expect(scopeLevels({ ...options, root: false }, "organization").map((entry) => entry.level)).toEqual(["location", "dealer"]);
    expect(scopeLevels({ root: true, places: [] }, "organization")).toEqual([{ level: "organization", chain: [] }]);
  });

  it("starts at the broadest level below the root", () => {
    expect(defaultLevel(scopeLevels(options, "organization"))?.level).toBe("dealer");
    expect(defaultLevel(scopeLevels({ root: true, places: [] }, "organization"))?.level).toBe("organization");
    expect(defaultLevel([])).toBeNull();
  });
});

describe("placesAt", () => {
  const location = { level: "location", chain: ["dealer", "location"] };

  it("offers, for a deeper level, only the places that have something below them, and then only what is below the chosen one", () => {
    expect(placesAt(options, location, 0, []).map((entry) => entry.name)).toEqual(["Auto Zagreb"]);
    expect(placesAt(options, location, 1, [3]).map((entry) => entry.name)).toEqual(["Zagreb Sjever", "Zagreb Jug"]);
    expect(placesAt(options, location, 1, [4])).toEqual([]);
  });

  it("offers every place of the level when the chain ends there", () => {
    expect(placesAt(options, { level: "dealer", chain: ["dealer"] }, 0, []).map((entry) => entry.name)).toEqual(["Auto Zagreb", "Auto Split"]);
  });
});
