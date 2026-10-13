import { accessFeature } from "@wssto2/vue-core/access";
import { permissions } from "./permissions";

// A role may be for new vehicles only, used only, or both: stored in the role's `attrs` under the key the permissions declare
// (`authz.Attributes("vehiclekind")` on the server: one lowercase word). "All" leaves the key out.
export const access = accessFeature({
  catalogue: permissions,
  roleConstraints: [
    {
      attribute: "vehiclekind",
      labelKey: "roles.vehicle_kind",
      options: [
        { value: "new", labelKey: "roles.kind.new" },
        { value: "used", labelKey: "roles.kind.used" },
      ],
    },
  ],
  // The sentences for the codes of the server's own role check (`access.WithRoleCheck`), as keys of the application's messages.
  problems: { vehicle_kind_conflict: "roles.problems.vehicle_kind_conflict" },
});

// roles.problems.vehicle_kind_conflict: "{permission} cannot be given to a role for used vehicles."
