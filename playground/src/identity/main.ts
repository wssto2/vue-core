// The sign-in flow against go-core's own dev server, with nothing faked:
//
//   go run github.com/wssto2/go-core/cmd/devserver      (in a go-core checkout, or by module path)
//   npm run dev                                         (in playground/, then open /identity.html)
//
// Sign in as admin / admin-password or user / user-password; admin may then sign in as user (the home page
// has the button) and sees the impersonation banner with the way back. Vite forwards /api to 127.0.0.1:8090, so the
// cookies are same-origin; the dev server also allows http://localhost:5173 directly.
//
// The users and profile screens come with usersFeature: admin sees /users (list, record, sessions, sign-ins, changes,
// activity, roles) and "My profile"; user sees only "My profile" (account menu). E-mail codes of an address change are
// printed in the dev server's log. Admin also edits roles (/iam/roles) and gives roles from a person's "Roles" section;
// user, who holds only crm.customer:view, sees none of it.
//
// Notifications (notificationsFeature): the bell is in the sidebar header (the top bar on phones). `user` has one unread and
// one read notification; "Send a test notification" on the home page sends another through the dev server's event queue and it
// arrives live. Admin (the webmaster) also opens "Failed events" (/events/dead-letters), empty until a consumer gives up on an event.
import { createApplication } from "@wssto2/vue-core/app";
import { identityFeature, identityPlatform, usersFeature } from "@wssto2/vue-core/identity";
import { notificationsFeature } from "@wssto2/vue-core/notifications";
import { createPlatform, parseBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";
import { createWebHashHistory } from "vue-router";
import "../app.css";
import { shellIcons } from "../app/icons";
import { appIcons } from "../icons";
import { accessFeatures } from "./access";
import { permissionMessages } from "./permissions";
import { homeFeature } from "./home";
import { rolesSection } from "./rolesSection";

const platform = createPlatform({
  config: parseBootstrap({ locale: "en", app_name: "go-core dev server", api_base: "/api" }),
  ...identityPlatform(),
});

void createApplication({
  platform,
  shell: backofficeShell(),
  features: [
    identityFeature(),
    usersFeature({ sections: [rolesSection], activityAreas: { crm: "areas.crm" } }),
    // The dev server's categories: its seeded notifications, and the module's own test one.
    notificationsFeature({ categories: { "devserver.sample": { icon: "user3Line", hue: "blue" }, "system.test": { icon: "checkCircle", hue: "teal" } } }),
    homeFeature,
    ...accessFeatures,
  ],
  router: { history: createWebHashHistory() },
  icons: [appIcons, shellIcons],
  i18n: { messages: { en: { ...permissionMessages.en, areas: { crm: "Customers" } } } },
  locale: { flags: { en: "GB", hr: "HR", sl: "SI" } },
}).mount("#app");
