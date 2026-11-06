import { describe, expect, it } from "vitest";
import cases from "../../../test-data/content/visibility.json";
import type { VisibilityRule } from "./schema";
import { evaluateVisibility } from "./visibility";

describe("evaluateVisibility", () => {
  it("runs every case of the shared fixture", () => {
    expect(cases.cases.length).toBeGreaterThan(40);
    for (const entry of cases.cases) {
      expect(evaluateVisibility(entry.rule as VisibilityRule | null, entry.values), entry.name).toBe(entry.visible);
    }
  });
});
