import type { Component } from "vue";
import type { ProfileResponse } from "../../modules/identity/entities";

/** The groups "My profile" ships, in page order, by the id a section positions itself against. */
export const PROFILE_PANELS = ["details", "email", "password", "sessions", "signins"] as const;
export type ProfilePanel = (typeof PROFILE_PANELS)[number];

/**
 * A group the application adds to "My profile" (its mobile phone, dealer and location, preferences). The component renders
 * its own `FormGroup`s (rows, a header, a footer; `ActionRow` for a row that opens something), so it reads like the built-in
 * ones; it gets the loaded `profile` as a prop and may emit `updated` with a changed `ProfileResponse`, as they do. Place it
 * `after` or `before` one of the built-in groups (the default is the end of the page); sections with the same position keep
 * the order they were given in.
 *
 *   usersFeature({ profileSections: [{ id: "preferences", component: PreferencesGroup, after: "password", visible: (p) => p.id !== 0 }] })
 */
export type ProfileSection = {
  /** Unique among the sections, one lowercase word (it is the section's `data-profile-section`). */
  readonly id: string;
  readonly component: Component;
  /** Whether to show it for this person; default always. */
  readonly visible?: (profile: ProfileResponse) => boolean;
} & ({ readonly after?: ProfilePanel; readonly before?: never } | { readonly before?: ProfilePanel; readonly after?: never });

/** One entry of the page: a built-in group or an application's section. */
export type ProfileEntry = { readonly kind: "panel"; readonly id: ProfilePanel } | { readonly kind: "section"; readonly section: ProfileSection };

/** The page's groups in order, with the visible sections slotted in. */
export function layoutProfile(sections: readonly ProfileSection[], profile: ProfileResponse): readonly ProfileEntry[] {
  const before = new Map<ProfilePanel, ProfileSection[]>();
  const after = new Map<ProfilePanel, ProfileSection[]>();
  const end: ProfileSection[] = [];
  for (const section of sections) {
    if (section.visible && !section.visible(profile)) continue;
    const anchor = section.after ?? section.before;
    const bucket = !anchor ? end : section.after ? (after.get(anchor) ?? after.set(anchor, []).get(anchor)!) : (before.get(anchor) ?? before.set(anchor, []).get(anchor)!);
    bucket.push(section);
  }
  const section = (item: ProfileSection): ProfileEntry => ({ kind: "section", section: item });
  return [
    ...PROFILE_PANELS.flatMap((id) => [...(before.get(id) ?? []).map(section), { kind: "panel", id } as const, ...(after.get(id) ?? []).map(section)]),
    ...end.map(section),
  ];
}
