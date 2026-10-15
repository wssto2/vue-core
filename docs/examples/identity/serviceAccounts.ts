// The composition root of an application with service accounts: sign-in, the access screens, then the service account screens.
import { createApplication } from "@wssto2/vue-core/app";
import { accessFeature } from "@wssto2/vue-core/access";
import { identityFeature, identityPlatform, serviceAccountsFeature } from "@wssto2/vue-core/identity";
import { createPlatform, readBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";
import { permissions } from "../access/permissions";

const platform = createPlatform({ config: readBootstrap(), ...identityPlatform() });

void createApplication({
  platform,
  shell: backofficeShell(),
  features: [
    identityFeature({ home: "/" }),
    // The roles of an account are the access screens': install them next to it.
    accessFeature({ catalogue: permissions }),
    // `destination` is the node of the server's menu that opens the list. Every screen and action is behind the permission go-core checks.
    serviceAccountsFeature({ destination: "serviceaccounts" }),
  ],
}).mount("#app");
