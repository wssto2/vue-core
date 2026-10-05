import { defineComponent, h, type Component } from "vue";
import type { RouteLocationRaw } from "vue-router";
import type { ShellDefinition } from "../app/application";
import type { SessionUser } from "../platform/session";
import BackofficeShell from "./BackofficeShell.vue";
import type { ShellIdentity } from "./identity";
import { createNavigationProgress } from "./progress";

export interface BackofficeShellOptions<U extends SessionUser = SessionUser> {
  /** Where the brand links to. Default `/`. */
  home?: RouteLocationRaw;
  /** Who is signed in, as the account menu shows them; typed with the application's own user. Default: `name` and `email` of the user, else the id. */
  identity?: (user: U) => ShellIdentity;
  /** The logo: a component that receives `tone` (`light` on the dark sidebar, `brand` on the page). Default: the application's name. */
  brand?: Component;
  /** Shown above the account block of the sidebar and the drawer. */
  footer?: Component;
  /** Extra content at the end of the top bar. */
  topBarEnd?: Component;
  /** Pull down from the top of the page to reload it (the page only; the shell stays), while the application runs installed. Default `true`. */
  pullToRefresh?: boolean;
}

/**
 * The backoffice shell as `createApplication` takes it: the layout, the slots it renders
 * (`headerActions`, `search`, `accountMenu`, `banner`, `host`) and the page-load indicator wired to the router.
 *
 *   createApplication({ platform, features, shell: backofficeShell({ brand: MyLogo }) });
 *
 * Use one definition per application (it owns that application's indicator).
 */
export function backofficeShell<U extends SessionUser = SessionUser>(options: BackofficeShellOptions<U> = {}): ShellDefinition {
  const progress = createNavigationProgress();
  const { brand, footer, topBarEnd } = options;
  const component = defineComponent({
    name: "BackofficeShell",
    setup() {
      return () =>
        h(
          BackofficeShell,
          {
            home: options.home,
            // The application's session produces U; the shell reads it as the SessionUser it is guaranteed to be.
            identity: options.identity as ((user: SessionUser) => ShellIdentity) | undefined,
            progress,
            pullToRefresh: options.pullToRefresh,
          },
          {
            ...(brand && { brand: (scope: { tone: "light" | "brand" }) => h(brand, scope) }),
            ...(footer && { footer: () => h(footer) }),
            ...(topBarEnd && { "top-bar-end": () => h(topBarEnd) }),
          },
        );
    },
  });
  return { component, slots: ["headerActions", "search", "accountMenu", "banner", "host"], progress };
}
