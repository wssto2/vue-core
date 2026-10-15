import { fireEvent, screen, waitFor, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findTest, queryTest } from "../../access/testing";
import { settle } from "../../testing";
import { callsTo, dataOf, refusal, stopApplications } from "../testing";
import { ACCOUNT_MANAGE, ACCOUNT_VIEW, KEY_REVOKE, account, apiKey, startAccounts } from "./testing";

vi.setConfig({ testTimeout: 30_000 });

afterEach(() => {
  stopApplications();
  vi.restoreAllMocks();
});

const keys = [apiKey(), apiKey({ id: 32, name: "Test", prefix: "gc_live_c91M", last_used_at: null, expires_at: "2026-12-31T22:59:59Z" }), apiKey({ id: 33, name: "Old", revoked_at: "2026-09-20T10:00:00Z" })];
const SECRET = "gc_live_Qm4t8Rz2Vb7Kc1Xp9Ln3Hs6Jd0Wf5Ey";
const PATH = "/v1/iam/service-accounts/21/keys";

function open(permissions: string[], options: { who?: ReturnType<typeof account>; answers?: Parameters<typeof startAccounts>[0]["answers"] } = {}) {
  return startAccounts({
    permissions,
    location: "/iam/service-accounts/21?tab=keys",
    answers: { "GET /v1/iam/service-accounts/21": dataOf(options.who ?? account()), [`GET ${PATH}`]: dataOf({ keys }), ...options.answers },
  });
}
const FULL = [ACCOUNT_VIEW, ACCOUNT_MANAGE, KEY_REVOKE];
const newKeyButton = async () => within(await findTest("new-api-key-action")).getByRole("button", { name: "New API key" });

describe("the API keys of an account", () => {
  it("lists each key: its start, who made it and when, last use and expiry, and a revoked one as revoked", async () => {
    const { target } = await open([ACCOUNT_VIEW]);
    const panel = (await findTest("api-keys")).textContent!;
    for (const text of ["Production", "gc_live_a8Zk…", "made by Ana Anić", "last used", "Does not expire", "Test", "never used", "expires", "Old", "Revoked"]) expect(panel).toContain(text);
    expect(target.querySelector("[data-test=api-keys]")).not.toBeNull();
  });

  it("offers Revoke only on a live key, and only with the right to revoke", async () => {
    await open([ACCOUNT_VIEW, KEY_REVOKE]);
    await findTest("api-keys");
    expect(queryTest("revoke-key-31")).not.toBeNull();
    expect(queryTest("revoke-key-32")).not.toBeNull();
    expect(queryTest("revoke-key-33")).toBeNull();
    stopApplications();
    await open([ACCOUNT_VIEW, ACCOUNT_MANAGE]);
    await findTest("api-keys");
    expect(queryTest("revoke-key-31")).toBeNull();
  });

  it("offers a new key to whoever manages a live account, not to a reader or on a deactivated one", async () => {
    await open(FULL);
    expect(await newKeyButton()).toBeTruthy();
    stopApplications();
    await open([ACCOUNT_VIEW]);
    await findTest("api-keys");
    expect(queryTest("new-api-key-action")).toBeNull();
    stopApplications();
    await open(FULL, { who: account({ deactivated_at: "2026-09-30T08:00:00Z" }) });
    await findTest("api-keys");
    expect(queryTest("new-api-key-action")).toBeNull();
  });

  it("asks before revoking, then revokes and reads the keys again", async () => {
    const { calls } = await open(FULL, { answers: { "POST /v1/iam/service-accounts/21/keys/31/revoke": new Response(null, { status: 204 }) } });
    await fireEvent.click(within(await findTest("revoke-key-31")).getByRole("button", { name: "Revoke" }));
    expect(await screen.findByText(/stops working at once/)).toBeTruthy();
    expect(callsTo(calls, "POST", "/v1/iam/service-accounts/21/keys/31/revoke")).toHaveLength(0);
    await fireEvent.click((await screen.findAllByRole("button", { name: "Revoke" })).at(-1) as HTMLElement);
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/iam/service-accounts/21/keys/31/revoke")).toHaveLength(1));
    expect(await screen.findByText("Key revoked")).toBeTruthy();
    await waitFor(() => expect(callsTo(calls, "GET", PATH).length).toBeGreaterThanOrEqual(2));
  });

  it("says why a revoke was refused and keeps what is there", async () => {
    const { calls } = await open(FULL, { answers: { "POST /v1/iam/service-accounts/21/keys/31/revoke": refusal(403, "authz.forbidden") } });
    await fireEvent.click(within(await findTest("revoke-key-31")).getByRole("button", { name: "Revoke" }));
    await fireEvent.click((await screen.findAllByRole("button", { name: "Revoke" })).at(-1) as HTMLElement);
    expect(await screen.findByText("You are not allowed to make this change in that place.")).toBeTruthy();
    expect(callsTo(calls, "GET", PATH)).toHaveLength(1);
    expect(queryTest("revoke-key-31")).not.toBeNull();
  });
});

describe("a new API key", () => {
  const created = { key: apiKey({ id: 34, name: "Staging" }), secret: SECRET };
  const withCreate = { [`POST ${PATH}`]: dataOf(created) };
  async function openSheet(answers: Parameters<typeof startAccounts>[0]["answers"] = withCreate) {
    const started = await open(FULL, { answers });
    await fireEvent.click(await newKeyButton());
    await settle();
    return started;
  }
  const name = (value: string) => fireEvent.update(screen.getByLabelText(/^Name/), value);
  const create = async () => {
    await fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    await settle();
  };
  const sent = (calls: Parameters<typeof callsTo>[0]) => JSON.parse(String(callsTo(calls, "POST", PATH)[0]!.init.body));

  it("needs a name", async () => {
    const { calls } = await openSheet();
    await create();
    expect(screen.getAllByText("Required.").length).toBeGreaterThanOrEqual(1);
    expect(callsTo(calls, "POST", PATH)).toHaveLength(0);
  });

  it("makes a key that does not expire without a date", async () => {
    const { calls } = await openSheet();
    await name("  Staging ");
    await create();
    await waitFor(() => expect(callsTo(calls, "POST", PATH)).toHaveLength(1));
    expect(sent(calls)).toEqual({ name: "Staging", expires_at: null });
    expect(new Headers(callsTo(calls, "POST", PATH)[0]!.init.headers).get("Idempotency-Key")).toBeTruthy();
  });

  it("makes a key that expires at the end of the chosen day", async () => {
    const { calls } = await openSheet();
    await name("Staging");
    const year = new Date().getFullYear() + 1;
    const expires = screen.getByLabelText(/Expires/) as HTMLInputElement;
    expires.focus();
    await fireEvent.update(expires, `12/31/${year}`);
    await fireEvent.blur(expires);
    await settle();
    await create();
    await waitFor(() => expect(callsTo(calls, "POST", PATH)).toHaveLength(1));
    expect(new Date(sent(calls).expires_at).getTime()).toBe(new Date(year, 11, 31, 23, 59, 59).getTime());
  });

  it("shows the reason when the key is refused", async () => {
    await openSheet({ [`POST ${PATH}`]: refusal(403, "authz.forbidden") });
    await name("Staging");
    await create();
    expect(document.body.textContent).toContain("You are not allowed to make this change in that place.");
    expect(queryTest("created-api-key")).toBeNull();
  });
});

describe("the created key: the secret is shown once", () => {
  const created = { key: apiKey({ id: 34, name: "Staging" }), secret: SECRET };

  async function makeKey() {
    const started = await open(FULL, { answers: { [`POST ${PATH}`]: dataOf(created) } });
    await fireEvent.click(await newKeyButton());
    await settle();
    await fireEvent.update(screen.getByLabelText(/^Name/), "Staging");
    await fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    await findTest("created-api-key");
    return started;
  }

  it("shows the whole secret with a plain warning that it will not be shown again", async () => {
    await makeKey();
    expect((await findTest("api-key-secret")).textContent).toBe(SECRET);
    expect((await findTest("api-key-once")).textContent).toContain("only time the key is shown");
  });

  it("copies the secret", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    await makeKey();
    await fireEvent.click(within(await findTest("copy-api-key")).getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(SECRET));
    expect(await screen.findByText("Key copied")).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it("falls back to the selection copy where the page has no async clipboard", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    const exec = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: exec });
    await makeKey();
    await fireEvent.click(within(await findTest("copy-api-key")).getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(exec).toHaveBeenCalledWith("copy"));
    expect(await screen.findByText("Key copied")).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it("does not close by Escape, only by 'I have saved the key'", async () => {
    await makeKey();
    await fireEvent.keyDown(document.body, { key: "Escape" });
    await settle();
    expect(queryTest("created-api-key")).not.toBeNull();
  });

  it("forgets the secret once it is saved: gone from the page, and the keys are read again", async () => {
    const { calls } = await makeKey();
    await fireEvent.click(screen.getByRole("button", { name: "I have saved the key" }));
    await waitFor(() => expect(queryTest("created-api-key")).toBeNull());
    await waitFor(() => expect(callsTo(calls, "GET", PATH).length).toBeGreaterThanOrEqual(2));
    expect(document.body.textContent).not.toContain(SECRET);
  });
});
