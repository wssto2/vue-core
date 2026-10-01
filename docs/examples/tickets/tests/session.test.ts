import { createTestPlatform, jsonResponse, scriptedTransport } from "@wssto2/vue-core/testing";
import { describe, expect, it, vi } from "vitest";
import { createTicketsApi } from "../api";

const ticket = { id: 1, subject: "Printer", status: "open", assignee: null, created_at: "2026-09-30T08:00:00Z" };

describe("the session under the api", () => {
  it("renews an expired session once and sends the failed request again", async () => {
    // A sequence: the first answer is a 401, the second the ticket.
    const { transport, calls } = scriptedTransport(jsonResponse(401, { message: "expired" }), jsonResponse(200, { success: true, data: ticket }));
    const renewSession = vi.fn(async () => true);
    const platform = createTestPlatform({ transport, renewSession });

    expect(await createTicketsApi(platform.http).get(1, new AbortController().signal)).toEqual(ticket);
    expect(renewSession).toHaveBeenCalledOnce();
    expect(calls).toHaveLength(2);
  });

  it("signs the user out when it cannot be renewed, and tells the application", async () => {
    const onSessionExpired = vi.fn();
    const platform = createTestPlatform({ transport: scriptedTransport(jsonResponse(401, {})).transport, renewSession: async () => false, onSessionExpired });

    await expect(createTicketsApi(platform.http).get(1, new AbortController().signal)).rejects.toMatchObject({ status: 401 });
    expect(platform.session.state.value).toEqual({ status: "anonymous", reason: "expired" });
    expect(onSessionExpired).toHaveBeenCalledOnce();
  });
});
