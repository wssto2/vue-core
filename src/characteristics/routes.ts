import type { RouteRecordRaw } from "vue-router";
import { defineRoutes } from "../router";
import { VIEW_CHARACTERISTICS } from "./access";

/**
 * The route of `characteristicsFeature`: a typed target for links (`characteristicsPages.index`) and the record the feature installs.
 * The name and path are fixed, so a link or a menu binding of the application can name them.
 */
export interface CharacteristicsPages {
  /** The records `characteristicsFeature` installs. */
  readonly records: readonly RouteRecordRaw[];
  readonly index: { readonly name: "characteristics.index" };
}

// Typed by hand: the inferred type would name the screen's module in the published declarations.
export const characteristicsPages: CharacteristicsPages = defineRoutes({
  index: { name: "characteristics.index", path: "/characteristics", component: () => import("./CharacteristicsPage.vue"), meta: { access: VIEW_CHARACTERISTICS, titleKey: "core.characteristics.title" } },
});
