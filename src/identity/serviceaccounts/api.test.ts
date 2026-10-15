import { describe, expect, it } from "vitest";
import { createHttpClient } from "../../client";
import { dataOf } from "../testing";
import { routedTransport } from "../../testing";
import { createServiceAccountsApi } from "./api";
import { account, apiKey } from "./testing";

function setup(answers: Parameters<typeof routedTransport>[0]) {
  const { transport, calls } = routedTransport(answers);
  return { api: createServiceAccountsApi(createHttpClient({ baseUrl: "", transport })), calls };
}
const bodyOf = (call: { init: RequestInit }) => JSON.parse(String(call.init.body));
const header = (call: { init: RequestInit }, name: string) => new Headers(call.init.headers).get(name);

describe("the service accounts api", () => {
  it("reads the list and one account", async () => {
    const { api } = setup({ "GET /v1/iam/service-accounts": dataOf({ service_accounts: [account()] }), "GET /v1/iam/service-accounts/21": dataOf(account()) });
    expect(await api.list()).toEqual([account()]);
    expect((await api.show(21)).name).toBe("DMS sync");
  });

  it("creates and updates with the attempt's idempotency key, the id in the path and not in the body", async () => {
    const { api, calls } = setup({ "POST /v1/iam/service-accounts": dataOf(account()), "PUT /v1/iam/service-accounts/21": dataOf(account()) });
    const input = { name: "DMS", description: "", tenant_id: 1, owner_id: 4 };
    await api.create(input, "key-1");
    await api.update(21, input, "key-2");
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual(["POST /v1/iam/service-accounts", "PUT /v1/iam/service-accounts/21"]);
    expect(bodyOf(calls[0]!)).toEqual(input);
    expect(bodyOf(calls[1]!)).toEqual(input);
    expect([header(calls[0]!, "Idempotency-Key"), header(calls[1]!, "Idempotency-Key")]).toEqual(["key-1", "key-2"]);
  });

  it("deactivates, lists keys, makes a key (its secret in the answer) and revokes one", async () => {
    const created = { key: apiKey({ id: 34 }), secret: "gc_live_secret" };
    const { api, calls } = setup({
      "POST /v1/iam/service-accounts/21/deactivate": dataOf(account({ deactivated_at: "2026-10-15T08:00:00Z" })),
      "GET /v1/iam/service-accounts/21/keys": dataOf({ keys: [apiKey()] }),
      "POST /v1/iam/service-accounts/21/keys": dataOf(created),
      "POST /v1/iam/service-accounts/21/keys/31/revoke": new Response(null, { status: 204 }),
    });
    expect((await api.deactivate(21)).deactivated_at).not.toBeNull();
    expect(await api.keys(21)).toEqual([apiKey()]);
    expect(await api.createKey(21, { name: "Staging", expires_at: null }, "key-3")).toEqual(created);
    await api.revokeKey(21, 31);
    expect(bodyOf(calls[2]!)).toEqual({ name: "Staging", expires_at: null });
    expect(header(calls[2]!, "Idempotency-Key")).toBe("key-3");
    expect(calls[3]!.url).toBe("/v1/iam/service-accounts/21/keys/31/revoke");
  });

  it("reads the active people, by name, as the users list's largest page", async () => {
    const row = { id: 4, login: "ivan", name: "Ivan Horvat", email: "", phone: "", locale: "en", active: true, status: "active", last_sign_in: null, locked_until: null, created_at: "2026-09-01T08:00:00Z" };
    const { api, calls } = setup({ "GET /v1/iam/users": dataOf({ data: [row], total: 1, per_page: 500, current_page: 1, last_page: 1, from: 1, to: 1 }) });
    expect(await api.people()).toEqual([{ id: 4, name: "Ivan Horvat" }]);
    const url = new URL(calls[0]!.url, "http://test.invalid");
    expect(Object.fromEntries(url.searchParams)).toEqual({ view: "active", order_col: "name", order_dir: "asc", page: "1", per_page: "500" });
  });
});
