// What an application can leave out, link to, or add.
import type { PersonSection } from "@wssto2/vue-core/identity";
import { usersFeature, usersRoutes, profileRoutes } from "@wssto2/vue-core/identity";
import { h } from "vue";

// Only "my profile": no users list, no record.
export const profileOnly = usersFeature({ people: false });

// No "Sign in as" (the application did not turn impersonation on), and the profile reached from its own menu.
export const withoutSignInAs = usersFeature({ signInAs: false, profile: false });

// Links are typed targets: `to` of a RouterLink or `router.push`.
export const toTheList = usersRoutes.index;
export const toAPerson = (id: number) => usersRoutes.record({ id });
export const toMyProfile = profileRoutes.index;

// A section of the application's own on a person's record, after the feature's own (their roles, say).
const Roles = { props: ["name"], render() { return h("p", `Roles of ${(this as unknown as { name: string }).name}`); } };
const roles: PersonSection = {
  path: "roles",
  component: Roles,
  props: (person) => ({ name: person.name }),
  meta: { section: { labelKey: "people.roles", icon: "user3Line", groupKey: "core.users.section_groups.access" } },
};
export const withRoles = usersFeature({ sections: [roles] });
