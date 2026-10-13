import type { Component } from "vue";
import type { ProfileResponse } from "../../modules/identity/entities";

/** The panels "My profile" ships, by the id a section positions itself against. */
export type ProfilePanel = "details" | "email" | "password" | "sessions" | "signins";

/**
 * A panel the application adds to "My profile" (its mobile phone, dealer and location, preferences). The component gets
 * the loaded `profile` as a prop and may emit `updated` with a changed `ProfileResponse`, as the built-in panels do. Place it
 * `after` or `before` one of the built-in panels (it joins that panel's column; the default is the end of the page); sections
 * with the same position keep the order they were given in.
 *
 *   usersFeature({ profileSections: [{ id: "preferences", component: PreferencesPanel, after: "password", visible: (p) => p.id !== 0 }] })
 */
export type ProfileSection = {
  /** Unique among the sections, one lowercase word (it is the section's `data-profile-section`). */
  readonly id: string;
  readonly component: Component;
  /** Whether to show it for this person; default always. */
  readonly visible?: (profile: ProfileResponse) => boolean;
} & ({ readonly after?: ProfilePanel; readonly before?: never } | { readonly before?: ProfilePanel; readonly after?: never });

/** One entry of the page: a built-in panel or an application's section. */
export type ProfileEntry = { readonly kind: "panel"; readonly id: ProfilePanel } | { readonly kind: "section"; readonly section: ProfileSection };

export interface ProfileLayout {
  readonly left: readonly ProfileEntry[];
  readonly right: readonly ProfileEntry[];
  readonly wide: readonly ProfileEntry[];
}

const panel = (id: ProfilePanel): ProfileEntry => ({ kind: "panel", id });

/** The panels in their columns with the visible sections slotted in: left (details, e-mail), right (password), then the full-width rest. */
export function layoutProfile(sections: readonly ProfileSection[], profile: ProfileResponse): ProfileLayout {
  const columns: Record<"left" | "right" | "wide", ProfileEntry[]> = { left: [panel("details"), panel("email")], right: [panel("password")], wide: [panel("sessions"), panel("signins")] };
  const columnOf = (id: ProfilePanel) => (id === "details" || id === "email" ? columns.left : id === "password" ? columns.right : columns.wide);
  for (const section of sections) {
    if (section.visible && !section.visible(profile)) continue;
    const entry: ProfileEntry = { kind: "section", section };
    const anchor = section.after ?? section.before;
    if (!anchor) {
      columns.wide.push(entry);
      continue;
    }
    const column = columnOf(anchor);
    // After the anchor and the sections already placed after it, so equal positions keep the given order.
    let at = column.findIndex((candidate) => candidate.kind === "panel" && candidate.id === anchor);
    for (let next = column[at + 1]; section.after && next?.kind === "section" && next.section.after === anchor; next = column[at + 1]) at++;
    column.splice(section.after ? at + 1 : at, 0, entry);
  }
  return columns;
}
