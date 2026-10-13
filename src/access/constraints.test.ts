import { describe, expect, it } from "vitest";
import { constraintAttrs, constraintChoices, type RoleConstraint } from "./constraints";

const vehicleKind: RoleConstraint = { attribute: "vehicle_kind", labelKey: "k", options: [{ value: "new", labelKey: "n" }, { value: "used", labelKey: "u" }] };

describe("a role constraint in attrs", () => {
  it("reads the one stored value as the choice, anything else as none", () => {
    expect(constraintChoices([vehicleKind], [{ attribute: "vehicle_kind", values: ["new"] }])).toEqual({ vehicle_kind: "new" });
    expect(constraintChoices([vehicleKind], [])).toEqual({ vehicle_kind: "" });
    expect(constraintChoices([vehicleKind], [{ attribute: "vehicle_kind", values: ["new", "used"] }])).toEqual({ vehicle_kind: "" });
    expect(constraintChoices([vehicleKind], [{ attribute: "vehicle_kind", values: ["boat"] }])).toEqual({ vehicle_kind: "" });
  });

  it("is written as one value, left out for none, and the other attributes stay", () => {
    const stored = [{ attribute: "region", values: ["north"] }, { attribute: "vehicle_kind", values: ["new"] }];
    const loaded = constraintChoices([vehicleKind], stored);
    expect(constraintAttrs([vehicleKind], stored, loaded, { vehicle_kind: "used" })).toEqual([{ attribute: "region", values: ["north"] }, { attribute: "vehicle_kind", values: ["used"] }]);
    expect(constraintAttrs([vehicleKind], stored, loaded, { vehicle_kind: "" })).toEqual([{ attribute: "region", values: ["north"] }]);
  });

  it("keeps a stored list the choice cannot show while the choice is left alone", () => {
    const stored = [{ attribute: "vehicle_kind", values: ["new", "used"] }];
    const loaded = constraintChoices([vehicleKind], stored);
    expect(constraintAttrs([vehicleKind], stored, loaded, loaded)).toEqual(stored);
  });
});
