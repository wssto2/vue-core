import { defineRoutes } from "@wssto2/vue-core/router";

declare module "@wssto2/vue-core/router" {
  interface DestinationRegistry {
    forms: true;
  }
}

export const formsRoutes = defineRoutes({
  index: { name: "forms.index", path: "/forms", component: () => import("./views/Index.vue"), meta: { titleKey: "forms.title" } },
  account: { name: "forms.account", path: "/forms/accounts/:accountID", component: () => import("./views/AccountRecord.vue"), meta: { titleKey: "forms.accounts", remountOnParam: "accountID" } },
  newOffer: { name: "forms.offer.new", path: "/forms/offers/new", component: () => import("./views/NewOffer.vue"), meta: { titleKey: "forms.newOffer" } },
});
