// The composition root of an application with the incident screens: sign-in, the incidents, and the browser's own errors reported to them.
import { createApplication } from "@wssto2/vue-core/app";
import { identityFeature, identityPlatform } from "@wssto2/vue-core/identity";
import { clientErrorReporter, incidentsFeature } from "@wssto2/vue-core/incidents";
import { createPlatform, readBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";

declare const __APP_VERSION__: string; // the build's version, defined by the bundler

const platform = createPlatform({ config: readBootstrap(), ...identityPlatform() });

void createApplication({
  platform,
  shell: backofficeShell(),
  features: [
    identityFeature({ home: "/" }),
    // `destination` is the node of the server's menu that opens the list; `appVersion` is filled into every report a person files.
    incidentsFeature({ destination: "incidents.index", appVersion: __APP_VERSION__ }),
  ],
  // Errors the browser hits in the application's own code become incidents (low severity, one per error); the console line stays.
  onError: clientErrorReporter({ platform, appVersion: __APP_VERSION__ }),
}).mount("#app");
