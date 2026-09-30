// Fixtures for this folder's tests; the declaration build excludes it.
/* eslint-disable vue/one-component-per-file -- test fixtures */
import { createApp, defineComponent, h, nextTick, type App } from "vue";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import { ApiError } from "../client";
import { installPlatform, type Platform } from "../platform";
import type { CollectionPage, CollectionQuery, LoadContext } from "./types";

export const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

export interface Row {
  readonly id: number;
  readonly title: string;
}

export const page = (rows: readonly Row[], overrides: Partial<CollectionPage<Row>> = {}): CollectionPage<Row> => ({
  rows,
  total: rows.length,
  page: 1,
  pageSize: 25,
  lastPage: rows.length === 0 ? 0 : 1,
  from: rows.length === 0 ? 0 : 1,
  to: rows.length,
  ...overrides,
});

/** A loader that records every call and answers from a queue, or from a function of the query. */
export function fakeLoader(answer: (query: CollectionQuery, context: LoadContext, call: number) => Promise<CollectionPage<Row>> | CollectionPage<Row>) {
  const calls: { query: CollectionQuery; signal: AbortSignal }[] = [];
  const load = (query: CollectionQuery, context: LoadContext) => {
    calls.push({ query, signal: context.signal });
    return Promise.resolve(answer(query, context, calls.length));
  };
  return { load, calls };
}

/** A promise that rejects as the client does when its signal aborts. */
export const abortable = <T>(signal: AbortSignal, promise: Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    signal.addEventListener("abort", () => reject(new ApiError({ kind: "aborted", message: "The request was cancelled" })));
    promise.then(resolve, reject);
  });

/** Lets microtasks, router navigations and Vue's queue settle: a macrotask per round. */
export const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  }
};

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

/** Runs a composable in a component of a real app, as it is used. */
export function inApp<T>(use: () => T, options: { router?: Router; platform?: Platform } = {}): { result: T; app: App; unmount: () => void } {
  let result!: T;
  const app = createApp(
    defineComponent({
      setup() {
        result = use();
        return () => null;
      },
    }),
  );
  if (options.router) app.use(options.router);
  if (options.platform) installPlatform(app, options.platform);
  app.mount(document.createElement("div"));
  return { result, app, unmount: () => app.unmount() };
}
