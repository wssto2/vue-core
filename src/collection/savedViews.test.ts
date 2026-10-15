import { describe, expect, it } from "vitest";
import { ApiError, createHttpClient, isAborted } from "../client";
import { jsonResponse, scriptedTransport, type Answer } from "../testing";
import { serverSavedViews } from "./savedViews";

const stored = { id: 7, list_key: "tickets", name: "Mine", state: { version: 2, filters: { status: "open" }, search: "golf", view: "mine" }, updated_at: "2026-10-15T10:00:00Z" };
const ok = (data: unknown) => jsonResponse(200, { success: true, data });

function setup(...answers: Answer[]) {
  const { transport, calls } = scriptedTransport(...answers);
  return { views: serverSavedViews(createHttpClient({ baseUrl: "/api", transport })), calls };
}

describe("serverSavedViews", () => {
  it("lists one list's views as id, name and state", async () => {
    const { views, calls } = setup(ok([stored]));
    const found = await views.list("tickets", { signal: new AbortController().signal });
    expect(found).toEqual([{ id: 7, name: "Mine", state: stored.state }]);
    expect(calls[0]?.method).toBe("GET");
    expect(calls[0]?.url).toBe("/api/v1/saved-views?list=tickets");
  });

  it("passes the library's abort signal, and an aborted list rejects as aborted", async () => {
    const { views, calls } = setup(ok([]));
    const controller = new AbortController();
    await views.list("tickets", { signal: controller.signal });
    expect(calls[0]?.init.signal?.aborted).toBe(false);
    controller.abort();
    await expect(views.list("tickets", { signal: controller.signal })).rejects.toSatisfy(isAborted);
  });

  it("saves the state as a JSON string under the list key and name, and returns the view with its state as an object", async () => {
    const { views, calls } = setup(ok(stored));
    const saved = await views.save("tickets", "Mine", { version: 2, filters: { status: "open" }, search: "golf", view: "mine" });
    expect(saved).toEqual({ id: 7, name: "Mine", state: stored.state });
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.url).toBe("/api/v1/saved-views");
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body).toEqual({ list_key: "tickets", name: "Mine", state: JSON.stringify({ version: 2, filters: { status: "open" }, search: "golf", view: "mine" }) });
    expect(typeof body.state).toBe("string");
  });

  it("leaves a null view out of the stored state and never invents a version", async () => {
    const { views, calls } = setup(ok({ ...stored, state: { filters: {}, search: "" } }));
    const saved = await views.save("tickets", "Plain", { version: 1, filters: {}, search: "", view: null });
    expect(JSON.parse(JSON.parse(String(calls[0]?.init.body)).state)).toEqual({ version: 1, filters: {}, search: "" });
    expect(saved.state).toEqual({ filters: {}, search: "" });
    expect("version" in saved.state).toBe(false);
  });

  it("removes by id, a string id included", async () => {
    const { views, calls } = setup(jsonResponse(204));
    await views.remove("tickets", 7);
    await views.remove("tickets", "8");
    expect(calls.map((call) => [call.method, call.url])).toEqual([
      ["DELETE", "/api/v1/saved-views/7"],
      ["DELETE", "/api/v1/saved-views/8"],
    ]);
  });

  it("lets the server's refusals through as ApiError", async () => {
    const { views } = setup(jsonResponse(400, { success: false, message: "too many saved views" }), jsonResponse(404, { success: false, message: "saved view not found" }));
    await expect(views.save("tickets", "Twenty-first", { version: 1, filters: {}, search: "" })).rejects.toMatchObject({ status: 400, message: "too many saved views" });
    const failure = await views.remove("tickets", 99).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 404 });
  });
});
