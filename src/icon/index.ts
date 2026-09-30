import type { CoreIconName } from "./core";

/**
 * The icon names of the app. The library declares none of its own here: an app adds its icons
 * by augmenting this interface (declaration merging, like vue-router's `RouteMeta`), so
 * `<Icon name="…">` is checked against what the app registered.
 *
 *   declare module "@wssto2/vue-core/icon" {
 *     interface IconRegistry { carLine: true; userLine: true }
 *   }
 *   installIcons(app, { carLine: "<svg …>", userLine: "<svg …>" });
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- an empty interface is the point: apps augment it
export interface IconRegistry {}

export type { CoreIconName } from "./core";
/** Every name `Icon` accepts: the library's own icons and the app's. */
export type IconName = CoreIconName | keyof IconRegistry;
/** Pixel sizes the design uses; the icon scales from its 24-unit viewBox. */
export type IconSize = 12 | 14 | 16 | 18 | 20 | 22 | 24 | 32;
/**
 * The SVG sources of the app's icons. Every registered name needs a source; the library's own
 * icons can be replaced by listing them here too.
 */
export type IconSet = { [Name in keyof IconRegistry]: string } & Partial<Record<CoreIconName, string>>;

export { default as Icon } from "./Icon.vue";
export { installIcons, provideIcons } from "./environment";
