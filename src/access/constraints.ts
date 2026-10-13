import type { Constraint } from "../modules/access/entities";

/** One option of a role constraint. */
export interface RoleConstraintOption {
  /** What is stored in the role's `attrs` for it. */
  readonly value: string;
  /** i18n key of its label. */
  readonly labelKey: string;
}

/**
 * A constraint the application puts on a role (go-core's `attrs`: attribute key -> values), edited as one choice among `options`
 * (the vehicle kinds a role may work with: new only, used only) or none, which leaves the key out of `attrs` ("allows all").
 */
export interface RoleConstraint {
  /** The attribute key the permissions declare (`authz.Attributes("vehicle_kind")`). */
  readonly attribute: string;
  /** i18n key of the field's label. */
  readonly labelKey: string;
  readonly options: readonly RoleConstraintOption[];
  /** i18n key of the choice for no constraint; by default `core.access.constraints.any` ("All"). */
  readonly anyLabelKey?: string;
}

/** The chosen option of each constraint, "" for none; a stored value list that is not exactly one value reads as none. */
export function constraintChoices(constraints: readonly RoleConstraint[], attrs: readonly Constraint[]): Record<string, string> {
  return Object.fromEntries(
    constraints.map(({ attribute, options }) => {
      const values = attrs.find((attr) => attr.attribute === attribute)?.values ?? [];
      return [attribute, values.length === 1 && options.some((option) => option.value === values[0]) ? (values[0] as string) : ""];
    }),
  );
}

/**
 * The `attrs` to save: what the role holds for attributes this editor does not manage stays as it is, and so does a managed one
 * the person left alone (a stored list the choice cannot show is not lost by saving something else); a changed choice replaces it.
 */
export function constraintAttrs(constraints: readonly RoleConstraint[], stored: readonly Constraint[], loaded: Record<string, string>, chosen: Record<string, string>): Constraint[] {
  const managed = new Set(constraints.map((constraint) => constraint.attribute));
  const kept = stored.filter((attr) => !managed.has(attr.attribute) || (chosen[attr.attribute] ?? "") === (loaded[attr.attribute] ?? ""));
  const changed = constraints.flatMap(({ attribute }): Constraint[] => {
    const value = chosen[attribute] ?? "";
    return value !== (loaded[attribute] ?? "") && value !== "" ? [{ attribute, values: [value] }] : [];
  });
  return [...kept, ...changed];
}
