import type { Route } from "@playwright/test";

/** What a handler needs of a request: its method, the path below `/api/v1`, the query and the JSON body (undefined for a read or an empty body). */
export function readRequest(route: Route) {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();
  const body: unknown = method === "GET" || !request.postData() ? undefined : request.postDataJSON();

  return { method, url, path: url.pathname.replace(/^\/api\/v1/, ""), body };
}

/** One write a mock saw: a spec reads what the page sent through these. */
export type Call = { method: string; path: string; body: unknown };
