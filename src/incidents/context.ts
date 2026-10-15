import type { Ref } from "vue";
import { defineFeatureContext } from "../platform";

/** What the screens of `incidentsFeature` share: whether the report dialog is open (the account menu's row sets it, the host shows it) and the build's version. */
export interface IncidentsContext {
  readonly reporting: Ref<boolean>;
  readonly appVersion: string;
}

export const [incidentsContextKey, useIncidentsContext] = defineFeatureContext<IncidentsContext>("vue-core.incidents");
