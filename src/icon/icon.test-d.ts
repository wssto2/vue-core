// Type fixtures: checked by `npm run typecheck`, never run. The library registers no names of
// its own, so only its core icons are valid here; the playground augments `IconRegistry`.
import { h } from "vue";
import Icon from "./Icon.vue";
import type { IconName, IconSet } from "./index";

h(Icon, { name: "close" });

// @ts-expect-error an unknown icon name is a type error
h(Icon, { name: "noSuchIcon" });

// @ts-expect-error sizes are the design's pixel sizes
h(Icon, { name: "close", size: 15 });

export const fine: IconName = "loader4Line";
// @ts-expect-error not an icon
export const notFine: IconName = "noSuchIcon";

// A set may replace core icons and, with no app names registered, holds nothing else.
export const set: IconSet = { close: "<svg/>" };
// @ts-expect-error a name nobody registered
export const extra: IconSet = { unknown: "<svg/>" };
