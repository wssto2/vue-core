// The sign-in flow against go-core's own dev server, with nothing faked:
//
//   go run github.com/wssto2/go-core/cmd/devserver      (in a go-core checkout, or by module path)
//   npm run dev                                         (in playground/, then open /identity.html)
//
// Sign in as admin / admin-password or user / user-password; admin may then sign in as user (the home page
// has the button) and sees the impersonation banner with the way back. Vite forwards /api to 127.0.0.1:8090, so the
// cookies are same-origin; the dev server also allows http://localhost:5173 directly.
import { createApplication } from "@wssto2/vue-core/app";
import { identityFeature, identityPlatform } from "@wssto2/vue-core/identity";
import { createPlatform, parseBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";
import { createWebHashHistory } from "vue-router";
import "../app.css";
import { shellIcons } from "../app/icons";
import { appIcons } from "../icons";
import { homeFeature } from "./home";

const platform = createPlatform({
  config: parseBootstrap({ locale: "en", app_name: "go-core dev server", api_base: "/api" }),
  ...identityPlatform(),
});

void createApplication({
  platform,
  shell: backofficeShell(),
  features: [identityFeature(), homeFeature],
  router: { history: createWebHashHistory() },
  icons: [appIcons, shellIcons],
  locale: { flags: { en: "GB", hr: "HR", sl: "SI" } },
}).mount("#app");
