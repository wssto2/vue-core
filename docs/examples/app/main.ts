// The composition root: the one place that knows every part of the application.
import { createApplication } from "@wssto2/vue-core/app";
import { createPlatform, readBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";
import { createAccountsFeature } from "../accounts/feature";
import { createTicketsFeature } from "../tickets/feature";
import { appIcons } from "./declarations";
import { sessionFeature } from "./session/feature";
import "./styles.css";

// 1. What the server embedded in the page (<script id="app-state" type="application/json">), validated once.
const config = readBootstrap();

// 2. The services every part shares: HTTP client, session, access. Nothing runs yet.
const platform = createPlatform({ config });

// 3. The application: an explicit list of features, and the shell around them.
const application = createApplication({
  platform,
  shell: backofficeShell(),
  icons: appIcons,
  features: [sessionFeature, createTicketsFeature(platform.http), createAccountsFeature(platform.http)],
});

void application.mount("#app");
