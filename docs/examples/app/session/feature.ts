import { defineFeature, keepSessionAlive } from "@wssto2/vue-core/app";
import { localeMessages } from "@wssto2/vue-core/i18n";
import { defineRoutes } from "@wssto2/vue-core/router";

// Every route needs a signed-in user unless it says `public`; the login page is the public one.
export const sessionRoutes = defineRoutes({
  login: { name: "login", path: "/login", component: () => import("./Login.vue"), meta: { public: true, titleKey: "session.login.title" } },
});

export const sessionFeature = defineFeature({
  id: "session",
  routes: sessionRoutes.records,
  messages: localeMessages("session", { en: async () => ({ default: { login: { title: "Sign in", submit: "Sign in" } } }) }),
  effects: [keepSessionAlive()], // renews the session shortly before it expires
});
