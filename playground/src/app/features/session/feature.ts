import { defineFeature } from "@wssto2/vue-core/app";
import { keepSessionAlive } from "@wssto2/vue-core/app";
import { defineRoutes } from "@wssto2/vue-core/router";
import { localeMessages } from "@wssto2/vue-core/i18n";
import SearchField from "./SearchField.vue";
import SessionActions from "./SessionActions.vue";

export const sessionRoutes = defineRoutes({
  login: {
    name: "login",
    path: "/login",
    component: () => import("./Login.vue"),
    meta: { public: true, titleKey: "session.login.title" },
  },
});

export const sessionFeature = defineFeature({
  id: "session",
  routes: sessionRoutes.records,
  messages: localeMessages("session", { en: () => import("./i18n/en.json"), hr: () => import("./i18n/hr.json") }),
  contributions: [
    // `authenticated`: rendered only while someone is signed in; its texts load with the page.
    { id: "session.actions", slot: "headerActions", component: SessionActions, scope: "authenticated", messages: ["session"] },
    // `optional`: the custom shell of the playground has no `search` place and leaves it out.
    { id: "session.search", slot: "search", component: SearchField, scope: "authenticated", messages: ["session"], optional: true },
  ],
  // Background behavior the application opts into: renew the session before it expires.
  effects: [keepSessionAlive()],
});
