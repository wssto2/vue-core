// The composition root of an application that administers people: sign-in, then the users and profile screens.
import { createApplication } from "@wssto2/vue-core/app";
import { identityFeature, identityPlatform, usersFeature } from "@wssto2/vue-core/identity";
import { createPlatform, readBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";

const platform = createPlatform({ config: readBootstrap(), ...identityPlatform() });

void createApplication({
  platform,
  shell: backofficeShell(),
  features: [
    identityFeature({ home: "/" }),
    // `destination` is the node of the server's menu that opens the list; every screen and action is behind the permission go-core checks.
    usersFeature({ destination: "users" }),
  ],
}).mount("#app");
