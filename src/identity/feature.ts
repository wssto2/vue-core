import type { RouteLocationRaw } from "vue-router";
import { defineFeature, keepSessionAlive, provideContext, type Feature } from "../app";
import { defineRoutes } from "../router";
import { identityContextKey } from "./context";
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
 * (route name `login`, public), and the session kept alive while the app is open. Pair it with
 * `createPlatform({ config, ...identityPlatform() })`, which wires the session, the refresh on 401 and sign-out.
 *
 *   createApplication({ platform, shell: backofficeShell(), features: [identityFeature({ home: "/tickets" })] })
 */
export function identityFeature(options: IdentityFeatureOptions = {}): Feature {
  return defineFeature({
    id: "identity",
    routes: routes.records,
    context: provideContext(identityContextKey, { home: options.home ?? "/" }),
    effects: [keepSessionAlive({ renew: renewIdentityTokens })],
  });
}
