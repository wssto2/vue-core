import { defineFeatureContext } from "@wssto2/vue-core/platform";
import type { SavedViews } from "@wssto2/vue-core/collection";
import type { LeadsApi } from "./api";
import type { createLeadList } from "./collection";

export interface LeadsDependencies {
  readonly api: LeadsApi;
  readonly list: ReturnType<typeof createLeadList>;
  /** Where saved filter sets live: the application's (the playground keeps them in memory). */
  readonly savedViews: SavedViews;
}

export const [LEADS, useLeads] = defineFeatureContext<LeadsDependencies>("playground.leads");
