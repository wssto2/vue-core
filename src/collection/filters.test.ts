import { describe, expect, it } from "vitest";
import { appliedFilterCount, filterChips, filterValueLabel, joinRange, narrowedOptions, splitRange, type FilterDescriptor } from "./filters";

// Ported from arv-next's filter_panel.test.ts.
const brand: FilterDescriptor = {
  key: "brand_id",
  label: "Brand",
  type: "select",
  placement: "panel",
  dependsOn: "category_id",
  options: [
    { value: 10, label: "Renault", parentValue: 1 },
    { value: 11, label: "Dacia", parentValue: 1 },
    { value: 12, label: "Renault", parentValue: 2 },
  ],
};

const model: FilterDescriptor = {
  key: "model_id",
  label: "Model",
  type: "select",
  placement: "panel",
  dependsOn: "brand_id",
  options: [
    { value: 100, label: "Captur", parentValue: 10 },
    { value: 102, label: "Master", parentValue: 12 },
    { value: 101, label: "Duster", parentValue: 11 },
  ],
};

describe("narrowedOptions", () => {
  it("carries the dot of the first option of a merged label, and only when there is one", () => {
    const filter: FilterDescriptor = { key: "k", label: "K", type: "select", options: [{ value: 1, label: "A", dot: "positive" }, { value: 2, label: "A" }, { value: 3, label: "B" }] };
    expect(narrowedOptions(filter, null)).toEqual([{ value: "1,2", label: "A", dot: "positive" }, { value: "3", label: "B" }]);
    expect(Object.keys(narrowedOptions(filter, null)[1]!)).toEqual(["label", "value"]);
  });

  it("merges same-named options into one id list while the parent is empty", () => {
    expect(narrowedOptions(brand, null)).toEqual([
      { label: "Renault", value: "10,12" },
      { label: "Dacia", value: "11" },
    ]);
  });

  it("narrows to the chosen parent", () => {
    expect(narrowedOptions(brand, "2")).toEqual([{ label: "Renault", value: "12" }]);
  });

  it("matches a parent that is itself a merged id list", () => {
    expect(narrowedOptions(model, "10,12")).toEqual([
      { label: "Captur", value: "100" },
      { label: "Master", value: "102" },
    ]);
  });
});

describe("ranges", () => {
  it("round-trips open-ended bounds", () => {
    expect(joinRange(2018, null)).toBe("2018,");
    expect(joinRange(null, 40000)).toBe(",40000");
    expect(joinRange(null, "")).toBeNull();
    expect(splitRange("2018,")).toEqual(["2018", null]);
    expect(splitRange(",40000")).toEqual([null, "40000"]);
    expect(splitRange(null)).toEqual([null, null]);
  });
});

describe("filterChips", () => {
  const words = { formatNumber: (n: number) => n.toLocaleString("hr-HR"), from: "From", until: "Until" };
  const category: FilterDescriptor = { key: "category_id", label: "Category", type: "select", placement: "panel", options: [{ value: 1, label: "Cars" }] };
  const type: FilterDescriptor = { key: "vehicle_type", label: "Type", type: "segmented", placement: "panel", options: [{ value: "new", label: "New" }] };
  const year: FilterDescriptor = { key: "year", label: "Year", type: "range", placement: "panel" };
  const price: FilterDescriptor = { key: "price", label: "Price", type: "range", placement: "panel", unit: "EUR" };
  const all = [type, category, brand, model, year, price];

  it("labels single filters and collapses a dependsOn chain into one chip", () => {
    expect(filterChips(all, { vehicle_type: "new", category_id: "1", brand_id: "10,12", model_id: "100", year: "1990,2026" }, words)).toEqual([
      { key: "vehicle_type", label: "Type", values: ["New"], clears: ["vehicle_type"] },
      { key: "category_id", label: null, values: ["Cars", "Renault", "Captur"], clears: ["category_id", "brand_id", "model_id"] },
      { key: "year", label: "Year", values: ["1990 – 2026"], clears: ["year"] },
    ]);
  });

  it("keeps the label when only one level of a chain is applied", () => {
    expect(filterChips(all, { brand_id: "11" }, words)).toEqual([{ key: "category_id", label: "Brand", values: ["Dacia"], clears: ["category_id", "brand_id", "model_id"] }]);
  });

  it("words open ranges and formats only amounts", () => {
    expect(filterValueLabel(year, "2018,", words)).toBe("from 2018");
    expect(filterValueLabel(price, ",40000", words)).toBe("until 40.000 EUR");
    expect(filterValueLabel(price, "", words)).toBeNull();
  });

  it("counts applied filters, not chips", () => {
    expect(appliedFilterCount(all, { category_id: "1", brand_id: "10", price: ",1" })).toBe(3);
  });

  it("lists applied toolbar filters with their option label", () => {
    const date: FilterDescriptor = { key: "created", label: "Created", type: "select", options: [{ value: "this_week", label: "This week" }] };
    expect(filterChips([date], { created: "this_week" }, words)).toEqual([{ key: "created", label: "Created", values: ["This week"], clears: ["created"] }]);
  });

  it("a mistaken dependsOn cycle does not loop forever", () => {
    const a: FilterDescriptor = { key: "a", label: "A", type: "select", dependsOn: "b", options: [{ value: 1, label: "one" }] };
    const b: FilterDescriptor = { key: "b", label: "B", type: "select", dependsOn: "a", options: [{ value: 1, label: "one" }] };
    expect(() => filterChips([a, b], { a: "1", b: "1" }, words)).not.toThrow();
  });
});
