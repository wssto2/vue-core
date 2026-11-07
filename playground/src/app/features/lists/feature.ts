import { defineFeature } from "@wssto2/vue-core/app";
import { localeMessages } from "@wssto2/vue-core/i18n";
import { listsRoutes } from "./routes";

// The file explorer on two screens (the pages of a host, the resources of a template). The tree screen is `characteristicsFeature` from the library.
export const listsFeature = defineFeature({
  id: "lists",
  routes: listsRoutes.records,
  messages: localeMessages("lists", { en: () => import("./i18n/en.json"), hr: () => import("./i18n/hr.json") }, { essential: true }),
  navigation: [
    { destination: "pageslist", to: listsRoutes.pages },
    { destination: "templateresources", to: listsRoutes.resources },
  ],
});
