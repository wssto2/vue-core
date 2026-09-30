// The options a real application usually sets on top of main.ts. Every one is optional.
import { createApplication, defineFeature } from "@wssto2/vue-core/app";
import { createPlatform, readBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";
import { pushCleanup } from "./effects";
import { sessionFeature } from "./session/feature";

// The server's page state: the shared keys (api_base, locale, app_name, capabilities) plus your own section,
// validated in one go. A missing or wrong value is one error naming every problem, before anything renders.
const config = readBootstrap({
  extend: (fields) => ({ market: fields.string("market", "hr"), currency: fields.string("currency") }),
});

const platform = createPlatform({
  config,
  // A 401 while signed in: renew once (true sends the failed request again); otherwise the session ends.
  renewSession: async (session) => {
    const response = await fetch(`${config.apiBase}/auth/refresh`, { method: "POST", credentials: "same-origin" });
    if (!response.ok) return false;
    await session.refresh();
    return true;
  },
  // Runs at every sign-out while the session still exists (max 3 s; a failure is reported, never blocks).
  beforeSignOut: async (user) => void navigator.sendBeacon(`${config.apiBase}/presence/leave`, JSON.stringify({ user: user.id })),
  onSessionError: (error) => console.error("session", error),
});

export const application = createApplication({
  platform,
  shell: backofficeShell(),
  features: [sessionFeature, defineFeature({ id: "push", effects: [pushCleanup] })],

  // Locales: the server's choice when offered, else `fallback`. The library ships en, hr, bs and sl.
  locale: {
    supported: ["hr", "en"],
    fallback: "en",
    // After a switch committed (not for the start locale, nor a superseded switch): save it on the user.
    onChange: async (locale) => void (await platform.http.put("/profile/locale", { locale })),
  },

  // Your texts per locale, merged over the library's `core` messages (any of its keys can be overridden).
  i18n: { messages: { en: { core: { shell: { account: { sign_out: "Log out" } } } } } },
  // Dates the way your users write them; the rest keeps the Intl defaults.
  formatting: { date: (value) => value.toLocaleDateString("de-DE") },

  // The destinations your backend's menu may name; a feature binding another one fails at startup.
  navigation: { known: ["tickets", "accounts"] },
  router: { login: { name: "login" }, home: "/tickets" },

  // Every error the application caught: component errors, unhandled rejections, failed effects and loads.
  onError: (report) => console.error(`[${report.source}]`, report.feature ?? "", report.error),
});
