// The composition root of an application with in-app notifications: sign-in, then the bell and the dead-letters page.
import { createApplication } from "@wssto2/vue-core/app";
import { identityFeature, identityPlatform } from "@wssto2/vue-core/identity";
import { notificationsFeature } from "@wssto2/vue-core/notifications";
import { createPlatform, readBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";

const platform = createPlatform({ config: readBootstrap(), ...identityPlatform() });

void createApplication({
  platform,
  shell: backofficeShell(),
  features: [
    identityFeature({ home: "/" }),
    notificationsFeature({
      // The categories go-core's `notification.Install` registered, drawn with an icon and a colour. Without an entry: the bell on a neutral tile.
      categories: { "tickets.assigned": { icon: "user3Line", hue: "blue" }, "system.test": { icon: "checkCircle", hue: "teal" } },
      // `destination` is the node of the server's menu that opens the page; `false` leaves the page out.
      deadLetters: { destination: "events.deadletters" },
      // The person's own settings page (default true): see "Notification settings"; their names come from the application's texts, see "Texts".
      settings: true,
    }),
  ],
}).mount("#app");
