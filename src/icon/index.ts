import type { CoreIconName } from "./core";

/**
 * The icon names of the app. The library declares none of its own here: an app adds its icons
 * by augmenting this interface (declaration merging, like vue-router's `RouteMeta`), so
 * `<Icon name="…">` is checked against what the app registered.
 *
 *   declare module "@wssto2/vue-core/icon" {
 *     interface IconRegistry { carLine: true; userLine: true }
 *   }
 *   installIcons(app, { carLine: "<svg …>" }, { userLine: "<svg …>" });  // partial sets, merged
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- an empty interface is the point: apps augment it
export interface IconRegistry {}

export type { CoreIconName } from "./core";
/** Every name `Icon` accepts: the library's own icons and the app's. */
export type IconName = CoreIconName | keyof IconRegistry;
/** Pixel sizes the design uses; the icon scales from its 24-unit viewBox. */
export type IconSize = 12 | 14 | 16 | 18 | 20 | 22 | 24 | 28 | 32;
/**
 * SVG sources by icon name. A set may be partial (a feature brings its own icons; `installIcons`
 * merges several) but may only hold registered names; the library's own icons can be replaced by
 * listing them too.
 */
export type IconSet = { [Name in IconName]?: string };

export { default as Icon } from "./Icon.vue";
export { installIcons, provideIcons } from "./environment";
