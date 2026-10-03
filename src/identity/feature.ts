import type { RouteLocationRaw } from "vue-router";
import { defineFeature, keepSessionAlive, provideContext, type Feature } from "../app";
import { defineRoutes } from "../router";
import { identityContextKey } from "./context";
import LocaleSync from "./LocaleSync.vue";
import ImpersonationBanner from "./ImpersonationBanner.vue";
import SessionExpiry from "./SessionExpiry.vue";
import { renewIdentityTokens } from "./session";

const routes = defineRoutes({
  login: { name: "login", path: "/login", component: () => import("./SignInPage.vue"), meta: { public: true, titleKey: "core.identity.signin.title" } },
});

export interface IdentityFeatureOptions {
  /** Where a person goes after signing in when they were not heading anywhere in particular. Default `/`. */
  home?: RouteLocationRaw;
}

/**
 * The sign-in screens of go-core's identity module, one feature to install: the sign-in page at `/login`
 * (route name `login`, public), the prompt that asks for the password again when the session ends in the middle of
 * work (the page stays, drafts survive; needs a shell with a `host` slot), a banner while signed in as somebody else, the session kept alive while the app is open, and the person's language kept
 * in step with the server (the account menu's language row saves it with `change-locale`). Pair it with
 * `createPlatform({ config, ...identityPlatform() })`, which wires the session, the refresh on 401 and sign-out.
 *
 *   createApplication({ platform, shell: backofficeShell(), features: [identityFeature({ home: "/tickets" })] })
 */
export function identityFeature(options: IdentityFeatureOptions = {}): Feature {
  return defineFeature({
    id: "identity",
    routes: routes.records,
    context: provideContext(identityContextKey, { home: options.home ?? "/" }),
    holdsExpiredSession: true,
    contributions: [
      // Not optional: a shell without a `host` could not ask for the password, and the person would be stuck on a dead page.
      { id: "identity.expiry", slot: "host", component: SessionExpiry, scope: "always" },
      // Not optional either: acting as somebody else must always be visible.
      { id: "identity.impersonation", slot: "banner", component: ImpersonationBanner, scope: "authenticated" },
      { id: "identity.locale", slot: "host", component: LocaleSync, scope: "authenticated", optional: true },
    ],
    effects: [keepSessionAlive({ renew: renewIdentityTokens })],
  });
}
