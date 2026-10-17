import { defineComponent, h, type Component } from "vue";
import type { RouteRecordRaw } from "vue-router";
import type { AccessRequirement, RouteSection } from "../../router";
import { useRouteResourceContext } from "../../resource";
import type { UserDetail } from "../../modules/identity/entities";
import { PERSON } from "./person";

/** The paths of the sections the feature's own record has, in order; what `PersonSection.after` can name. */
export const PERSON_SECTIONS = ["general", "signin", "sessions", "signins", "changes", "activity"] as const;
export type BuiltInPersonSection = (typeof PERSON_SECTIONS)[number];

/**
 * A section the application adds to a person's record (their roles, say). The component gets what `props` makes of the loaded
 * person; `meta` is the section's route meta (its label, icon and `access`). It is listed after the feature's own, or, with
 * `after`, right behind one of them and in that one's group (`meta.section.groupKey` is then the group's):
 *
 *   usersFeature({ sections: [{ path: "roles", after: "signin", component: PersonAccess, props: (p) => ({ subject: { kind: "user", id: p.id }, name: p.name }), meta: personRolesSection }] })
 */
export interface PersonSection {
  /** The child route's path under `/users/:id/` and its name suffix (`users.record.<path>`): one lowercase word. */
  readonly path: string;
  /** Places the section right after this built-in one, in its group (Sign-in is in "Access", so a section after it is too). Several after the same one keep their order. Without it: at the end. */
  readonly after?: BuiltInPersonSection;
  readonly component: Component;
  readonly props?: (person: UserDetail) => Record<string, unknown>;
  readonly meta: { readonly access?: AccessRequirement; readonly section: RouteSection };
}

/** The child route of the record for an extra section; `groupKey` puts it in the group of the section it follows. */
function personSectionRoute(section: PersonSection, groupKey?: string): RouteRecordRaw {
  const host = defineComponent({
    name: `PersonSection(${section.path})`,
    setup() {
      const person = useRouteResourceContext(PERSON);
      return () => (person.data.value ? h(section.component, section.props?.(person.data.value) ?? {}) : null);
    },
  });
  return { name: `users.record.${section.path}`, path: section.path, component: host, meta: { ...section.meta, ...(groupKey !== undefined && { section: { ...section.meta.section, groupKey } }) } };
}

/**
 * The record's children with the application's sections in place: behind the built-in one they name, in its group, or at the
 * end. A name that is not a built-in section is a start-up error that lists the valid ones.
 */
export function withPersonSections(children: readonly RouteRecordRaw[], sections: readonly PersonSection[]): RouteRecordRaw[] {
  for (const { path, after } of sections) {
    if (after !== undefined && !PERSON_SECTIONS.includes(after)) {
      throw new Error(`usersFeature: the section "${path}" is placed after "${after}", which is not a section of a person's record (${PERSON_SECTIONS.join(", ")}).`);
    }
  }
  const placed = (anchor: RouteRecordRaw) => sections.filter((section) => section.after === anchor.path).map((section) => personSectionRoute(section, anchor.meta?.section?.groupKey));
  return [...children.flatMap((child) => [child, ...placed(child)]), ...sections.filter((section) => section.after === undefined).map((section) => personSectionRoute(section))];
}
