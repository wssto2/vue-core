// Fixtures for this folder's tests; the declaration build excludes it.
import { defineComponent, h, type Plugin } from "vue";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import { ApiError } from "../client";
import { installPlatform, type Platform } from "../platform";
import { settle, withSetup } from "../testing";
import { listPage } from "../testing/collection";
import type { ListPage } from "./types";

export { deferred } from "../testing/async";
export { fakeLoader } from "../testing/collection";

export interface Row {
  readonly id: number;
  readonly title: string;
}

export const page = (rows: readonly Row[], overrides: Partial<ListPage<Row>> = {}): ListPage<Row> => listPage(rows, overrides);

/** A promise that rejects as the client does when its signal aborts. */
export const abortable = <T>(signal: AbortSignal, promise: Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    signal.addEventListener("abort", () => reject(new ApiError({ kind: "aborted", message: "The request was cancelled" })));
    promise.then(resolve, reject);
  });

/** Lets microtasks, router navigations and Vue's queue settle: a macrotask per round. */
export const flush = (times = 3) => settle(times);

export async function makeRouter(path = "/list") {
  const view = defineComponent({ render: () => h("div") });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/list", name: "list", component: view },
      { path: "/other", name: "other", component: view },
      { path: "/records/:recordID", name: "record", component: view },
    ],
  });
  await router.push(path);
  await router.isReady();
  return router;
}

/** Runs a composable in a component with only what is given (the router, the platform): no router and no platform unless passed, to test the errors. */
export function inApp<T>(use: () => T, options: { router?: Router; platform?: Platform } = {}) {
  const plugins: Plugin[] = [];
  if (options.router) plugins.push(options.router);
  if (options.platform) plugins.push({ install: (app) => installPlatform(app, options.platform as Platform) });
  return withSetup(use, { plugins });
}
