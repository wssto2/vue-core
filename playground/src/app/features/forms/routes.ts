import { defineRoutes } from "@wssto2/vue-core/router";

declare module "@wssto2/vue-core/router" {
  interface DestinationRegistry {
    forms: true;
  }
}

export const formsRoutes = defineRoutes({
  index: { name: "forms.index", path: "/forms", component: () => import("./views/Index.vue"), meta: { titleKey: "forms.title" } },
  account: { name: "forms.account", path: "/forms/accounts/:accountID", component: () => import("./views/AccountRecord.vue"), meta: { titleKey: "forms.accounts", remountOnParam: "accountID" } },
  dates: { name: "forms.dates", path: "/forms/dates", component: () => import("./views/Dates.vue"), meta: { titleKey: "forms.dates.title" } },
  options: { name: "forms.options", path: "/forms/options", component: () => import("./views/Options.vue"), meta: { titleKey: "forms.options.title" } },
  pickers: { name: "forms.pickers", path: "/forms/pickers", component: () => import("./views/Pickers.vue"), meta: { titleKey: "forms.pickers.title" } },
  section: { name: "forms.section", path: "/forms/section", component: () => import("./views/Section.vue"), meta: { titleKey: "forms.section.title" } },
  newOffer: { name: "forms.offer.new", path: "/forms/offers/new", component: () => import("./views/NewOffer.vue"), meta: { titleKey: "forms.newOffer" } },
});
