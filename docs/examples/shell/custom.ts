import { createApplication } from "@wssto2/vue-core/app";
import { createPlatform, readBootstrap } from "@wssto2/vue-core/platform";
import { sessionFeature } from "../app/session/feature";
import CustomShell from "./CustomShell.vue";
import { notificationsFeature } from "./feature";

// A custom shell is a component plus the slots it renders. Naming them lets the application fail at startup when a
// feature contributes to a slot the shell does not have (instead of the contribution silently not showing).
createApplication({
  platform: createPlatform({ config: readBootstrap() }),
  shell: { component: CustomShell, slots: ["headerActions", "accountMenu", "host"] },
  features: [sessionFeature, notificationsFeature],
});
