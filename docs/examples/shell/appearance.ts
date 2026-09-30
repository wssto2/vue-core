import { defineFeature } from "@wssto2/vue-core/app";
import DarkModeRow from "./DarkModeRow.vue";

// `accountMenu` entries render as a popover on desktop and a grouped sheet on phones: write the row once.
export const appearanceFeature = defineFeature({
  id: "appearance",
  contributions: [{ id: "appearance.dark", slot: "accountMenu", component: DarkModeRow, scope: "authenticated", order: 10 }],
});
