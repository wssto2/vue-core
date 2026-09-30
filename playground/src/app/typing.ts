// Type fixtures of the application's typed surface, checked by the playground's `vue-tsc`: what the
// app declared (its permissions, its destinations, its route parameters) is enforced at the call
// site, through the packed declarations. Never imported at runtime.
import { defineFeature, provideContext } from "@wssto2/vue-core/app";
import { defineFeatureContext } from "@wssto2/vue-core/platform";
import { defineRoutes } from "@wssto2/vue-core/router";
import { ticketRoutes } from "./features/tickets/routes";
import "./platform"; // the augmentations of PermissionRegistry and DestinationRegistry

const view = { render: () => null };
const [KEY] = defineFeatureContext<{ readonly name: string }>("fixture");

export const declared = defineRoutes({ page: { name: "p", path: "/p", component: view, meta: { access: { any: ["tickets:view", "reports:view"] } } } });
export const parameter = ticketRoutes.record({ ticketID: 1 });

defineRoutes({
  page: {
    name: "q",
    path: "/q",
    component: view,
    // @ts-expect-error a permission the application did not declare
    meta: { access: "tickets:delete" },
  },
});

defineFeature({
  id: "fixture",
  navigation: [
    // @ts-expect-error a destination the backend's menu does not have
    { destination: "nowhere", to: declared.page },
    { destination: "tickets", to: declared.page },
  ],
});

// @ts-expect-error a missing route parameter
ticketRoutes.record({});
// @ts-expect-error a parameter the route does not have
ticketRoutes.record({ ticketID: 1, extra: 2 });

// @ts-expect-error a context value of the wrong type for its key
provideContext(KEY, { name: 42 });
provideContext(KEY, { name: "fine" });

defineFeature({
  id: "fixture-two",
  // @ts-expect-error a slot the shell does not document
  contributions: [{ id: "x", slot: "footer", component: view, scope: "always" }],
});
