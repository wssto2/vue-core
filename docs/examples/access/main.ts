// The composition root of an application with roles: the access feature next to sign-in.
import { accessFeature } from "@wssto2/vue-core/access";
import { createApplication } from "@wssto2/vue-core/app";
import { identityFeature, identityPlatform } from "@wssto2/vue-core/identity";
import { createPlatform, readBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";
import { permissions } from "./permissions";

const platform = createPlatform({ config: readBootstrap(), ...identityPlatform() });

const application = createApplication({
  platform,
  shell: backofficeShell(),
  features: [
    identityFeature({ home: "/tickets" }),
    accessFeature({
      // The roles editor is this catalogue: modules, screens, actions.
      catalogue: permissions,
      // A holder's name on a role's page leads to their record (null: not a link).
      subjectRoute: (subject) => (subject.kind === "user" ? { name: "users.record", params: { id: subject.id } } : null),
      // The backend's menu entry that opens the list of roles.
      destination: "iam.roles",
    }),
  ],
});

void application.mount("#app");
