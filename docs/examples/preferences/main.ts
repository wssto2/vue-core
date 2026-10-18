import { createApplication } from "@wssto2/vue-core/app";
import { identityFeature, identityPlatform } from "@wssto2/vue-core/identity";
import { createPlatform, readBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell, darkMode } from "@wssto2/vue-core/shell";

const platform = createPlatform({ config: readBootstrap(), ...identityPlatform() });

// `darkMode()` keeps the person's choice as `dark_mode` in their stored preferences: nothing else to write.
void createApplication({ platform, shell: backofficeShell(), features: [identityFeature({ home: "/" }), darkMode()] }).mount("#app");
