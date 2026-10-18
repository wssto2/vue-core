import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "../client";
import { createTestApplication, createTestPlatform, jsonResponse, scriptedTransport } from "../testing";
import { found, readRecord, readRecordWithMeta } from "./read";

let application: { dispose(): void } | null = null;
afterEach(() => application?.dispose());
function appAnswering(answer: Parameters<typeof scriptedTransport>[0]) {
  const { transport, calls } = scriptedTransport(answer);
  application = createTestApplication({ platform: createTestPlatform({ transport }) });
  return calls;
}

describe("readRecord", () => {
  it("reads the record through the current application's client, with the page's signal", async () => {
    const calls = appAnswering(jsonResponse(200, { id: 7, name: "Golf" }));
    const controller = new AbortController();
    await expect(readRecord<{ id: number }>("/v1/cars/7", { signal: controller.signal })).resolves.toEqual({ id: 7, name: "Golf" });
    expect(calls[0]!.url).toBe("/v1/cars/7");
    expect(calls[0]!.init.signal).toBe(controller.signal);
  });

  it("reads meta beside the record", async () => {
    appAnswering(jsonResponse(200, { success: true, data: { id: 7 }, meta: { author: { id: 1 } } }));
    await expect(readRecordWithMeta<{ id: number }, { author: { id: number } }>("/v1/cars/7", { signal: new AbortController().signal })).resolves.toEqual({ data: { id: 7 }, meta: { author: { id: 1 } } });
  });

  it("fails like a request does, with an ApiError (a 404 is not found)", async () => {
    appAnswering(jsonResponse(404, { success: false, message: "no such car" }));
    await expect(readRecord("/v1/cars/9", { signal: new AbortController().signal })).rejects.toMatchObject({ kind: "notFound", status: 404 });
  });

  it("throws the actionable error when no application exists", async () => {
    await expect(readRecord("/v1/cars/9", { signal: new AbortController().signal })).rejects.toThrow(/createApplication/);
  });
});

describe("found", () => {
  it("hands back the record and turns the server's null into a not-found ApiError", () => {
    expect(found({ id: 1 })).toEqual({ id: 1 });
    expect(() => found(null)).toThrow(ApiError);
    try {
      found(null);
    } catch (error) {
      expect(error).toMatchObject({ kind: "notFound", status: 404 });
    }
  });
});
