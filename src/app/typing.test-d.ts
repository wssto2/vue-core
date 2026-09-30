// Type fixtures, checked by `npm run typecheck` (vue-tsc): positive cases must compile, every
// `@ts-expect-error` line must fail to. Nothing here runs.
import { defineFeatureContext } from "../platform";
import { defineFeature, provideContext, type AppEffect, type SessionEffect } from "./index";

const view = { render: () => null };
const [NUMBER_KEY] = defineFeatureContext<number>("fixture.number");

// --- positive: everything a feature can declare
export const complete = defineFeature({
  id: "complete",
  routes: [{ name: "a", path: "/a", component: view }],
  context: [provideContext(NUMBER_KEY, 1)],
  contributions: [{ id: "c", slot: "headerActions", component: view, scope: "authenticated", order: 1, messages: ["x"], optional: true }],
  effects: [
    { id: "app", scope: "app", start: ({ signal }) => { void signal.aborted; return () => {}; } },
    { id: "session", scope: "session", start: ({ user }) => { void user.id; } },
  ],
  backend: ["tickets"],
  requires: ["other", complete_ref()],
});

function complete_ref() {
  return { id: "ref" };
}

// --- negative
// @ts-expect-error a context value must match its key
provideContext(NUMBER_KEY, "one");
// @ts-expect-error a feature needs an id
defineFeature({ routes: [] });
// @ts-expect-error a contribution has a scope
defineFeature({ id: "x", contributions: [{ id: "c", slot: "host", component: view }] });
// @ts-expect-error an app effect has no user; only a session effect is given one
export const appEffect: AppEffect = { id: "e", scope: "app", start: ({ user }) => { void user; } };
// @ts-expect-error an effect has a scope
export const scopeless: SessionEffect = { id: "e", start: () => {} };
