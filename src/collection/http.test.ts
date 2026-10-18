import { describe, expect, it } from "vitest";
import { createHttpClient } from "../client";
import { route, type ListResult, type PageMeta } from "../client";
import { jsonResponse, scriptedTransport } from "../testing";
import { afterEach } from "vitest";
import { createTestApplication, createTestPlatform } from "../testing";
import { httpList, listLoader, listParams, readListPage, routeListLoader } from "./http";
import { defineCollection } from "./definition";

const query = { page: 2, pageSize: 10, sort: "title", direction: "desc" as const, search: "golf", view: "mine", filters: { status: "open", page: "evil" } };

describe("go-core list answers", () => {
  it("maps the datatable meta", () => {
    const result = readListPage<{ id: number }>(
      { data: [{ id: 1 }], meta: { total: 31, page: 2, per_page: 10, last_page: 4, from: 11, to: 11, views: [{ key: "mine", count: 3 }, { nokey: 1 }], authors: [1] }, message: null, status: 200, requestId: "r1" },
      query,
    );
    expect(result).toMatchObject({ total: 31, page: 2, pageSize: 10, lastPage: 4, from: 11, to: 11, views: [{ key: "mine", count: 3 }], requestId: "r1" });
    expect(result.meta).toMatchObject({ authors: [1] });
  });

  it("maps ARV's older shape with the numbers next to data", () => {
    const result = readListPage<{ id: number }>(
      { data: { data: [{ id: 1 }, { id: 2 }], total: 2, current_page: 1, per_page: 25, last_page: 1, from: 1, to: 2 }, meta: null, message: null, status: 200, requestId: null },
      query,
    );
    expect(result).toMatchObject({ total: 2, page: 1, pageSize: 25, lastPage: 1, from: 1, to: 2 });
  });

  it("derives missing numbers instead of reporting 0 (ARV kept per_page 0)", () => {
    const result = readListPage<{ id: number }>({ data: [{ id: 1 }, { id: 2 }], meta: { total: 52 }, message: null, status: 200, requestId: null }, { page: 3, pageSize: 10 });
    expect(result).toMatchObject({ total: 52, page: 3, pageSize: 10, lastPage: 6, from: 21, to: 22 });
  });

  it("reads an empty result", () => {
    expect(readListPage({ data: [], meta: { total: 0 }, message: null, status: 200, requestId: null }, query)).toMatchObject({ rows: [], total: 0, lastPage: 0, from: 0, to: 0 });
    expect(readListPage({ data: null, meta: null, message: null, status: 200, requestId: null }, query).rows).toEqual([]);
  });
});

describe("a typed route feeding a collection", () => {
  it("reads a ListResult<Row> with Row inferred", async () => {
    const list = route<{ page: number }, ListResult<{ id: number }>>("GET", "/v1/users");
    const body = { data: [{ id: 1 }], meta: { authors: [2], views: [{ key: "all", count: 31 }] }, total: 31, per_page: 10, current_page: 2, last_page: 4, from: 11, to: 11 };
    const { transport } = scriptedTransport(jsonResponse(200, { success: true, data: body }));
    const result = await createHttpClient({ transport }).request(list, { page: 2 });
    const page = readListPage(result, { page: 2, pageSize: 10 });
    expect(page.rows[0]?.id).toBe(1);
    expect(page).toMatchObject({ total: 31, page: 2, pageSize: 10, lastPage: 4, from: 11, to: 11, meta: { authors: [2] }, views: [{ key: "all", count: 31 }] });
    // `meta.views` is typed: no cast to read a count
    const count: number | undefined = result.data.meta?.views?.[0]?.count;
    expect(count).toBe(31);
  });
});

describe("a route.Page route feeding a collection", () => {
  it("reads Row[] with a PageMeta, no cast", async () => {
    const list = route<{ page: number }, { id: number }[], PageMeta>("GET", "/v1/vehicles");
    const meta = { total: 31, page: 2, per_page: 10, last_page: 4, from: 11, to: 11, views: [{ key: "all", count: 31 }] };
    const { transport } = scriptedTransport(jsonResponse(200, { success: true, data: [{ id: 1 }], meta }));
    const result = await createHttpClient({ transport }).request(list, { page: 2 });
    const page = readListPage(result, { page: 2, pageSize: 10 });
    expect(page.rows[0]?.id).toBe(1);
    expect(page).toMatchObject({ total: 31, page: 2, pageSize: 10, lastPage: 4, views: [{ key: "all", count: 31 }] });
  });
});

describe("listParams and httpList", () => {
  it("uses the canonical parameter names and lets reserved names win over a filter of the same name", () => {
    expect(listParams(query)).toEqual({ status: "open", page: 2, per_page: 10, order_col: "title", order_dir: "desc", search: "golf", view: "mine" });
    expect(listParams({ ...query, sort: null })).toMatchObject({ order_col: null, order_dir: null });
  });

  it("calls the endpoint with the query and the signal, and normalizes the answer", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(200, { success: true, data: [{ id: 1 }], meta: { total: 1, page: 1, per_page: 25, last_page: 1, from: 1, to: 1 } }));
    const http = createHttpClient({ baseUrl: "/api", transport });
    const definition = defineCollection({ id: "t", stateVersion: 1, load: httpList<{ id: number }>(http, "/tickets"), key: (row) => row.id });
    const controller = new AbortController();
    const loaded = await definition.load({ ...definition.defaults, search: "a b" }, { signal: controller.signal });
    expect(calls[0]!.url).toBe("/api/tickets?page=1&per_page=25&search=a+b");
    expect(calls[0]!.init.signal).toBe(controller.signal);
    expect(loaded.rows).toEqual([{ id: 1 }]);
  });
});

describe("listLoader and routeListLoader on the current application", () => {
  let application: { dispose(): void } | undefined;
  afterEach(() => application?.dispose());
  const meta = { total: 1, page: 1, per_page: 25, last_page: 1, from: 1, to: 1 };

  it("listLoader reads the client when the list loads, not when it is declared", async () => {
    const load = listLoader<{ id: number }>("/tickets"); // declared before any application exists
    const { transport, calls } = scriptedTransport(jsonResponse(200, { success: true, data: [{ id: 1 }], meta }));
    application = createTestApplication({ platform: createTestPlatform({ transport }) });
    const controller = new AbortController();
    const page = await load({ ...defineCollection({ id: "t", stateVersion: 1, load, key: (row: { id: number }) => row.id }).defaults, search: "a" }, { signal: controller.signal });
    expect(calls[0]!.url).toBe("/tickets?page=1&per_page=25&search=a");
    expect(page.rows).toEqual([{ id: 1 }]);
  });

  it("routeListLoader asks a typed route with the path parameters and the collection's query", async () => {
    const list = route<{ id: number; page: number }, { id: number }[], PageMeta>("GET", "/v1/dealers/:id/cars");
    const { transport, calls } = scriptedTransport(jsonResponse(200, { success: true, data: [{ id: 5 }], meta }));
    application = createTestApplication({ platform: createTestPlatform({ transport }) });
    const load = routeListLoader(list, { id: 3 });
    const page = await load({ page: 1, pageSize: 25, sort: null, direction: "asc", search: "", view: null, filters: {} }, { signal: new AbortController().signal });
    expect(calls[0]!.url).toContain("/v1/dealers/3/cars");
    expect(page.rows).toEqual([{ id: 5 }]);
  });
});
