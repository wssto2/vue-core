/**
 * The category hues of `Badge`: nine colours for telling things of one kind apart (where a lead came
 * from, a kind of document), never for a state. Separate from `Tone`, which owns red, green, orange
 * and sky blue for meaning; every hue here has its own `category-<name>-content` / `-surface` roles in the
 * theme, checked for text contrast in light and dark. The app maps its categories to hues in one place.
 */
export const HUES = ["amber", "lime", "teal", "cyan", "blue", "indigo", "violet", "fuchsia", "pink"] as const;

export type Hue = (typeof HUES)[number];
