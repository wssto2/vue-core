// The composition root of an application on go-core's identity module: sign-in, session and language.
import { createApplication } from "@wssto2/vue-core/app";
import { identityFeature, identityPlatform } from "@wssto2/vue-core/identity";
import { createPlatform, readBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";
import { createTicketsFeature } from "../tickets/feature";

// `identityPlatform()` wires the session to go-core's routes (read it, end it, renew it on a 401).
const platform = createPlatform({ config: readBootstrap(), ...identityPlatform() });

const application = createApplication({
  platform,
  shell: backofficeShell(),
  // The sign-in page (route `login`) and the person's language come with the feature.
  features: [identityFeature({ home: "/tickets" }), createTicketsFeature(platform.http)],
});

void application.mount("#app");
