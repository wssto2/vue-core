import { defineFeature } from "@wssto2/vue-core/app";
import { localeMessages } from "@wssto2/vue-core/i18n";
import ThemeRows from "./ThemeRows.vue";

// A feature that only contributes to the shell: two rows in the account menu, with their own texts.
export const themeFeature = defineFeature({
  id: "theme",
  messages: localeMessages("theme", { en: () => import("./i18n/en.json"), hr: () => import("./i18n/hr.json") }),
  contributions: [{ id: "theme.rows", slot: "accountMenu", component: ThemeRows, scope: "authenticated", messages: ["theme"], order: 10 }],
});
