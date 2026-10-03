import { defineComponent, h, type Component } from "vue";
import type { RouteRecordRaw } from "vue-router";
import type { UserDetail } from "../../modules/identity/entities";
import type { AccessRequirement, RouteSection } from "../../router";
import { useRouteResourceContext } from "../../resource";
import { PERSON } from "./person";

/**
 * A section the application adds to a person's record (their roles, say), listed after the feature's own. The component
 * gets what `props` makes of the loaded person; `meta` is the section's route meta (its label, icon and `access`).
 *
 *   usersFeature({ sections: [{ path: "roles", component: PersonAccess, props: (p) => ({ subject: { kind: "user", id: p.id }, name: p.name }), meta: personRolesSection }] })
 */
export interface PersonSection {
  /** The child route's path under `/users/:id/` and its name suffix (`users.record.<path>`): one lowercase word. */
  readonly path: string;
  readonly component: Component;
  readonly props?: (person: UserDetail) => Record<string, unknown>;
  readonly meta: { readonly access?: AccessRequirement; readonly section: RouteSection };
}

/** The child route of the record for an extra section. */
export function personSectionRoute(section: PersonSection): RouteRecordRaw {
  const host = defineComponent({
    name: `PersonSection(${section.path})`,
    setup() {
      const person = useRouteResourceContext(PERSON);
      return () => (person.data.value ? h(section.component, section.props?.(person.data.value) ?? {}) : null);
    },
  });
  return { name: `users.record.${section.path}`, path: section.path, component: host, meta: { ...section.meta } };
}
