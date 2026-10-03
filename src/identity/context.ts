import type { RouteLocationRaw } from "vue-router";
import { defineFeatureContext } from "../platform";

/** What the sign-in page needs from the feature that installed it. */
export interface IdentityContext {
  /** Where a person goes after signing in when they were not heading anywhere in particular. */
  readonly home: RouteLocationRaw;
}

export const [identityContextKey, useIdentityContext] = defineFeatureContext<IdentityContext>("vue-core.identity");
