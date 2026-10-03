import type { PersonSection } from "@wssto2/vue-core/identity";
import { h } from "vue";

// Stands where an application's own section goes (the roles of a person); it is given the person by `props`.
export const rolesStub: PersonSection = {
  path: "roles",
  component: { props: ["name"], render() { return h("p", { class: "text-content-muted" }, `Roles of ${(this as unknown as { name: string }).name} would be here.`); } },
  props: (person) => ({ name: person.name }),
  meta: { section: { labelKey: "core.users.sections.general", icon: "user3Line", groupKey: "core.users.section_groups.access" } },
};
