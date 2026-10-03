import { PersonAccess, personRolesSection } from "@wssto2/vue-core/access";
import type { PersonSection } from "@wssto2/vue-core/identity";

// A person's roles on the users record: V13's section, handed to usersFeature (identity imports nothing from access).
export const rolesSection: PersonSection = {
  path: "roles",
  component: PersonAccess,
  props: (person) => ({ subject: { kind: "user", id: person.id }, name: person.name }),
  meta: personRolesSection,
};
