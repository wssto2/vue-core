// What an application can leave out, link to, or add.
import type { OpenChangeRow, PersonSection, UserRow } from "@wssto2/vue-core/identity";
import { PERSON, USER_VIEWS, identityRoutes, usePersonActions, usersFeature, usersRoutes, profileRoutes } from "@wssto2/vue-core/identity";
import type { HttpClient } from "@wssto2/vue-core/client";
import { defineCollection, readListPage } from "@wssto2/vue-core/collection";
import { useRouteResourceContext } from "@wssto2/vue-core/resource";
import { FormGroup, FormRow } from "@wssto2/vue-core/form";
import { defineComponent, h } from "vue";

// Only "my profile": no users list, no record.
export const profileOnly = usersFeature({ people: false });

// No "Sign in as" (the application did not turn impersonation on), and the profile reached from its own menu.
export const withoutSignInAs = usersFeature({ signInAs: false, profile: false });

// Links are typed targets: `to` of a RouterLink or `router.push`.
export const toTheList = usersRoutes.index;
export const toAPerson = (id: number) => usersRoutes.record({ id });
export const toMyProfile = profileRoutes.index;

// A section of the application's own on a person's record (their roles, say): right after Sign-in and in its group ("Access"),
// or, without `after`, at the end.
const Roles = { props: ["name"], render() { return h("p", `Roles of ${(this as unknown as { name: string }).name}`); } };
const roles: PersonSection = {
  path: "roles",
  after: "signin",
  component: Roles,
  props: (person) => ({ name: person.name }),
  meta: { section: { labelKey: "people.roles", icon: "user3Line" } },
};
export const withRoles = usersFeature({ sections: [roles] });

// The Activity section names the application's areas (the keys the audit records) by its own texts.
export const withActivityAreas = usersFeature({ activityAreas: { crm: "areas.crm", billing: "areas.billing" } });

// The list of people with a filter the library does not know (a dealer): the one definition the list page and the record's previous / next
// both ask the server with. The page that lists with it is the application's (`replace.list`).
declare const http: HttpClient; // the application's client
const peopleList = defineCollection({
  id: "identity.users",
  stateVersion: 1,
  load: async (query, { signal }) =>
    readListPage<UserRow>(await http.request(identityRoutes.usersList, { view: query.view ?? undefined, page: query.page, per_page: query.pageSize, dealer_id: query.filters.dealer_id }, { signal }), query),
  key: (user: UserRow) => user.id,
  query: { sorts: ["name"], filters: ["dealer_id"], views: USER_VIEWS },
  defaults: { sort: "name", view: "active" },
});
const PeopleList = defineComponent({ render: () => h("p", "The list, with useCollection(peopleList, …)") });
export const withDealerFilter = usersFeature({ collection: peopleList, replace: { list: PeopleList } });

// A group of the application's own on "my profile", after the personal details: it renders its own FormGroup and gets the loaded profile.
const Phone = {
  props: ["profile"],
  render(this: { profile: { name: string } }) {
    return h(FormGroup, { header: "Mobile phone" }, () => h(FormRow, { layout: "setting", label: "Mobile phone", sub: this.profile.name }));
  },
};
export const withPhoneGroup = usersFeature({ profileSections: [{ id: "phone", component: Phone, after: "details", visible: (profile) => profile.id !== 0 }] });

// The list under another path (a record is `<path>/:id`); the route names stay, so links by name follow.
export const underIam = usersFeature({ path: "/iam/users" });

// The application's own words for the records the Activity section names: a kind (an i18n key) and the page of the record.
export const withActivityRecords = usersFeature({
  activityRecords: { customers: { labelKey: "records.customer", to: (id) => ({ name: "customer", params: { id } }) } },
});

// The application's wording for a change the library has no sentence for (the server's change log wrote an `ext`).
// Return nothing for a row the library words well; details may link.
export const withChangeWords = usersFeature({
  changeWords: (row: OpenChangeRow, t) => {
    const ext = row.ext as { role: string; binding: number } | undefined;
    if (row.action !== "role_granted" || !ext) return undefined;
    return { sentence: t("changes.role_granted", { role: ext.role }), details: [{ text: t("changes.binding"), to: { name: "binding", params: { id: ext.binding } } }] };
  },
});

// A whole screen swapped for the application's own. This details section reads the person (with the `ext` the server's
// user extension wrote) and the actions the record page offers; the list, the New user dialog and the Deactivate dialog
// are swapped the same way (the contract of each is on `UsersReplace`).
const Details = defineComponent({
  setup() {
    const person = useRouteResourceContext(PERSON);
    const actions = usePersonActions();
    return () => h("p", `${(person.data.value?.ext as { dealer?: string } | undefined)?.dealer ?? "-"} ${actions.can.manage ? "(editable)" : ""}`);
  },
});

export const withReplacements = usersFeature({ replace: { general: Details } });
