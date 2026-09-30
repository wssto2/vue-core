import { defineRoutes } from "@wssto2/vue-core/router";

// The sections of a record are its children with `meta.section`; the page's navigator lists them. The bare URL has
// no section of its own: the navigator moves it to the first section the user may open. `meta.access` on a
// child hides that section from the ones who may not open it.
export const accountRoutes = defineRoutes({
  record: {
    name: "accounts.record",
    path: "/accounts/:accountID",
    component: () => import("./views/Record.vue"),
    meta: { access: "accounts:view", titleKey: "accounts.title", remountOnParam: "accountID" },
    children: [
      { name: "accounts.record.general", path: "general", component: () => import("./views/General.vue"), meta: { section: { labelKey: "accounts.sections.general", icon: "informationLine" } } },
      { name: "accounts.record.activity", path: "activity", component: () => import("./views/Activity.vue"), meta: { section: { labelKey: "accounts.sections.activity", icon: "refreshLine" } } },
    ],
  },
});
