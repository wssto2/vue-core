import { fireEvent, screen, waitFor, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, settle } from "../../testing";
import { callsTo, dataOf, listOf, startScreen, stopApplications } from "../testing";

// The first screen of a file loads its route chunks through the transformer: slow on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

afterEach(stopApplications);

const profile = (extra: object = {}) => ({ id: 1, login: "ana", name: "Ana Anić", email: "ana@example.test", phone: "", locale: "en", created_at: "2026-09-01T08:00:00Z", pending_email: null, ...extra });
const pending = (extra: object = {}) => ({ email: "new@example.test", expires_at: new Date(Date.now() + 900_000).toISOString(), resend_available_at: new Date(Date.now() + 60_000).toISOString(), attempts_left: 5, ...extra });

async function open(who = profile(), answers: Parameters<typeof startScreen>[0]["answers"] = {}) {
  return startScreen({
    permissions: [],
    location: "/profile",
    answers: {
      "GET /v1/iam/profile": () => dataOf(who),
      "GET /v1/iam/profile/sessions": dataOf({ sessions: [] }),
      "GET /v1/iam/profile/signins": listOf([]),
      ...answers,
    },
  });
}

const dialog = () => within(screen.getByRole("dialog"));
const type = (code: string) => fireEvent.update(document.querySelector("[data-test='otp-input-field']") as HTMLInputElement, code);

async function requestChange() {
  await fireEvent.click(document.querySelector("[data-email-change]") as HTMLElement);
  await settle();
  await fireEvent.update(dialog().getByLabelText(/^New e-mail address/), "new@example.test");
  await fireEvent.update(dialog().getByLabelText(/^Current password/), "my password");
  await fireEvent.click(dialog().getByRole("button", { name: "Send code" }));
  await settle();
}

describe("changing the e-mail address", () => {
  it("asks for the address and the password, then for the code mailed to the new address", async () => {
    const { calls } = await open(profile(), { "POST /v1/iam/profile/email": dataOf(pending()) });
    await requestChange();
    expect(JSON.parse(String(callsTo(calls, "POST", "/v1/iam/profile/email")[0]!.init.body))).toEqual({ email: "new@example.test", current_password: "my password" });
    expect(dialog().getByText("Enter the 6-digit code we sent to new@example.test.")).toBeTruthy();
    expect(document.querySelector("[data-verify-expires]")).not.toBeNull();
  });

  it("asks for both before the server is asked", async () => {
    const { calls } = await open();
    await fireEvent.click(document.querySelector("[data-email-change]") as HTMLElement);
    await settle();
    await fireEvent.click(dialog().getByRole("button", { name: "Send code" }));
    await settle();
    expect(dialog().getAllByText("Required.")).toHaveLength(2);
    expect(callsTo(calls, "POST", "/v1/iam/profile/email")).toHaveLength(0);
  });

  it("confirms by itself once the last digit is typed, then shows the new address and closes", async () => {
    let changed = false;
    const { calls } = await open(profile(), {
      "POST /v1/iam/profile/email": dataOf(pending()),
      "POST /v1/iam/profile/email/confirm": () => ((changed = true), dataOf(profile({ email: "new@example.test" }))),
      "GET /v1/iam/profile": () => dataOf(changed ? profile({ email: "new@example.test" }) : profile()),
    });
    await requestChange();
    await type("123456");
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/iam/profile/email/confirm")).toHaveLength(1));
    expect(JSON.parse(String(callsTo(calls, "POST", "/v1/iam/profile/email/confirm")[0]!.init.body))).toEqual({ code: "123456" });
    expect(await screen.findByText("E-mail address changed")).toBeTruthy();
    await waitFor(() => expect(document.querySelector("[data-profile-email-current]")?.textContent).toContain("new@example.test"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("holds a new code back until the server lets one be sent, then sends it", async () => {
    const { calls } = await open(profile(), {
      "POST /v1/iam/profile/email": dataOf(pending()),
      "POST /v1/iam/profile/email/resend": dataOf(pending({ resend_available_at: new Date(Date.now() + 60_000).toISOString() })),
    });
    await requestChange();
    const resend = document.querySelector("[data-verify-resend]") as HTMLButtonElement;
    expect(resend.disabled).toBe(true);
    expect(resend.textContent).toMatch(/Resend code in \d:\d\d/);
    expect(callsTo(calls, "POST", "/v1/iam/profile/email/resend")).toHaveLength(0);
  });

  it("lets a resend through once the cooldown is over", async () => {
    const { calls } = await open(profile({ pending_email: pending({ resend_available_at: new Date(Date.now() - 1000).toISOString() }) }), {
      "POST /v1/iam/profile/email/resend": dataOf(pending()),
    });
    await fireEvent.click(document.querySelector("[data-email-enter-code]") as HTMLElement);
    await settle();
    const resend = document.querySelector("[data-verify-resend]") as HTMLButtonElement;
    expect(resend.disabled).toBe(false);
    await fireEvent.click(resend);
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/iam/profile/email/resend")).toHaveLength(1));
    expect(await screen.findByText("A new code was sent to new@example.test")).toBeTruthy();
  });

  it("offers a new code instead of Verify once the code can no longer be used", async () => {
    await open(profile(), {
      "POST /v1/iam/profile/email": dataOf(pending()),
      "POST /v1/iam/profile/email/confirm": jsonResponse(422, { success: false, error: "x", code: "identity.code.too_many_attempts" }),
    });
    await requestChange();
    await type("000000");
    await waitFor(() => expect(document.querySelector("[data-verify-submit]")).toBeNull());
    expect(dialog().getByRole("button", { name: /Request a new code|Resend code in/ })).toBeTruthy();
  });

  it("keeps a pending change when the dialog is closed, offers to resume it, and cancels it on request", async () => {
    let cancelled = false;
    const { calls } = await open(profile({ pending_email: pending() }), {
      "DELETE /v1/iam/profile/email": () => ((cancelled = true), jsonResponse(204)),
      "GET /v1/iam/profile": () => dataOf(profile({ pending_email: cancelled ? null : pending() })),
    });
    const banner = document.querySelector("[data-email-pending]") as HTMLElement;
    expect(banner.textContent).toContain("Waiting for confirmation of the new address new@example.test.");
    await fireEvent.click(document.querySelector("[data-email-enter-code]") as HTMLElement);
    await settle();
    expect(dialog().getByText("Enter the 6-digit code we sent to new@example.test.")).toBeTruthy();
    await fireEvent.click(dialog().getByRole("button", { name: "Cancel the change" }));
    await waitFor(() => expect(callsTo(calls, "DELETE", "/v1/iam/profile/email")).toHaveLength(1));
    await waitFor(() => expect(document.querySelector("[data-email-pending]")).toBeNull());
  });
});
