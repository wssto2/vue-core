import { createApplication } from "@wssto2/vue-core/app";
import { characteristicsFeature } from "@wssto2/vue-core/characteristics";
import { identityFeature, identityPlatform } from "@wssto2/vue-core/identity";
import { createPlatform, parseBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";

declare module "@wssto2/vue-core/router" {
  interface DestinationRegistry {
    characteristics: true;
  }
}

// The whole screen: the tree from GET /v1/characteristics, the form from GET /description. The menu node the server sends for it is bound to the feature.
const platform = createPlatform({ config: parseBootstrap({ locale: "hr", app_name: "Admin", api_base: "/api" }), ...identityPlatform() });

export const application = createApplication({
  platform,
  shell: backofficeShell(),
  features: [identityFeature(), characteristicsFeature({ destination: "characteristics" })],
});
