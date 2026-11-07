import type { NavigationNode } from "@wssto2/vue-core/platform";

// What go-core's menu sends: a node with `route` is a destination the app binds to one of its routes, a node with `href` (and no
// `route`) leaves the app. The rail draws it as a plain link with an "opens outside the app" marker; the browser loads the page.
export const navigation: readonly NavigationNode[] = [
  {
    i18n: "navigation.structure",
    children: [
      { i18n: "navigation.pages", icon: "file", route: "pages" },
      { i18n: "navigation.old_admin", icon: "settings", href: "/old-admin/" },
    ],
  },
];
