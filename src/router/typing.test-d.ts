// Type fixtures, checked by `npm run typecheck` (vue-tsc): positive cases must compile, every
// `@ts-expect-error` line must fail to. Nothing here runs.
import type { RouteLocationRaw } from "vue-router";
import { defineRoutes, type RouteParams } from "./index";

const view = () => import("../state/Skeleton.vue");

const routes = defineRoutes({
  index: { name: "tickets.index", path: "/tickets", component: view },
  record: { name: "tickets.record", path: "/tickets/:ticketID", component: view, children: [{ name: "tickets.general", path: "general", component: view }] },
  optional: { name: "tickets.search", path: "/search/:term?", component: view },
  pair: { name: "tickets.pair", path: "/dealers/:dealerID/locations/:locationID(\\d+)", component: view },
  file: { name: "tickets.file", path: "/files/:name.:ext", component: view },
  many: { name: "tickets.tags", path: "/tags/:tag+", component: view },
});

// --- positive: a route without parameters is a value, with parameters a function of exactly those
export const index: RouteLocationRaw = routes.index;
export const record: RouteLocationRaw = routes.record({ ticketID: 12 });
export const recordByText: RouteLocationRaw = routes.record({ ticketID: "12" });
export const pair: RouteLocationRaw = routes.pair({ dealerID: 1, locationID: 2 });
export const file: RouteLocationRaw = routes.file({ name: "a", ext: "pdf" });
export const tags: RouteLocationRaw = routes.many({ tag: "a" });
export const searchWithout: RouteLocationRaw = routes.optional();
export const searchWith: RouteLocationRaw = routes.optional({ term: "x" });
export const records = routes.records;
export const params: RouteParams<"/tickets/:ticketID"> = { ticketID: 1 };
export const indexName: "tickets.index" = routes.index.name;

// --- negative: a missing, wrong or extra parameter, and a value where a function is needed
// @ts-expect-error the parameter is required
routes.record();
// @ts-expect-error missing ticketID
routes.record({});
// @ts-expect-error wrong parameter name
routes.record({ ticketId: 1 });
// @ts-expect-error a parameter no path declares
routes.record({ ticketID: 1, extra: 2 });
// @ts-expect-error a parameter must be a string or a number
routes.record({ ticketID: true });
// @ts-expect-error only one of two required parameters
routes.pair({ dealerID: 1 });
// @ts-expect-error the route without parameters is a value, not a function
routes.index();
// @ts-expect-error an unknown key has no target
routes.missing;
// @ts-expect-error a route without a name cannot be navigated to
defineRoutes({ anonymous: { path: "/x", component: view } });
// @ts-expect-error `records` is the result's own key
defineRoutes({ records: { name: "a", path: "/a", component: view } });
