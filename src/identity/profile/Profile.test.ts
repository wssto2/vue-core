import { fireEvent, screen, waitFor, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, settle } from "../../testing";
import { callsTo, dataOf, listOf, startScreen, stopApplications } from "../testing";

// The first screen of a file loads its route chunks through the transformer: slow on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

afterEach(stopApplications);

const profile = (extra: object = {}) => ({ id: 1, login: "ana", name: "Ana Anić", email: "ana@example.test", phone: "", locale: "en", created_at: "2026-09-01T08:00:00Z", pending_email: null, ...extra });
const session = (id: number, extra: object = {}) => ({ id, device: `Chrome on Mac ${id}`, ip: "10.0.0.1", opened_by: null, current: false, last_used_at: "2026-10-02T08:00:00Z", expires_at: "2026-10-03T08:00:00Z", created_at: "2026-10-01T08:00:00Z", ...extra });

async function open(answers: Parameters<typeof startScreen>[0]["answers"] = {}, who = profile()) {
  return startScreen({
    permissions: [],
    location: "/profile",
    answers: {
      "GET /v1/iam/profile": () => dataOf(who),
      "GET /v1/iam/profile/sessions": dataOf({ sessions: [session(7, { current: true }), session(8)] }),
      "GET /v1/iam/profile/signins": listOf([{ id: 1, event: "signed_in", ip: "10.0.0.1", device: "Chrome on Mac", actor: null, created_at: "2026-10-01T08:30:00Z" }]),
      ...answers,
    },
  });
}

describe("my profile", () => {
  it("needs only a session: it shows the person's own account, devices and sign-ins", async () => {
    const { target } = await open();
    expect((screen.getByLabelText(/Full name/) as HTMLInputElement).value).toBe("Ana Anić");
    expect((target.querySelector("[data-profile-login] input, input[data-profile-login]") as HTMLInputElement).disabled).toBe(true);
    expect(target.querySelector("[data-profile-email-current]")?.textContent).toContain("ana@example.test");
    expect(target.querySelector("[data-session='7'] [data-session-current]")?.textContent).toBe("This device");
    expect(target.querySelector("[data-session='7'] [data-end-session]")).toBeNull(); // leaving this device is signing out
    expect(target.querySelector("[data-session='8'] [data-end-session]")).not.toBeNull();
    expect(target.querySelector("[data-event='signed_in']")?.textContent).toBe("Signed in");
  });

  it("has an entry in the account menu that opens it", async () => {
    await startScreen({ permissions: [], location: "/", answers: {} });
    await fireEvent.click(screen.getByRole("button", { name: /Ana/ }));
    await settle();
    expect(screen.getByRole("link", { name: "My profile" }).getAttribute("href")).toBe("/profile");
  });

  it("is not there when the application leaves it out", async () => {
    const { application } = await startScreen({ permissions: [], location: "/", answers: {}, users: { profile: false } });
    expect(application.router.hasRoute("profile")).toBe(false);
    expect(application.router.hasRoute("users.index")).toBe(true);
  });
});

describe("personal details", () => {
  it("saves the name and phone, says so and tells the session so the account menu follows", async () => {
    const { calls } = await open({ "PUT /v1/iam/profile": dataOf(profile({ name: "Ana M.", phone: "099 111" })) });
    const before = callsTo(calls, "GET", "/v1/auth/me").length;
    await fireEvent.update(screen.getByLabelText(/Full name/), "Ana M.");
    await fireEvent.update(screen.getByLabelText(/Phone number/), "099 111");
    expect(document.querySelector("[data-unsaved]")).not.toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    await waitFor(() => expect(callsTo(calls, "PUT", "/v1/iam/profile")).toHaveLength(1));
    expect(JSON.parse(String(callsTo(calls, "PUT", "/v1/iam/profile")[0]!.init.body))).toEqual({ name: "Ana M.", phone: "099 111" });
    expect(await screen.findByText("Personal details saved")).toBeTruthy();
    await waitFor(() => expect(callsTo(calls, "GET", "/v1/auth/me").length).toBeGreaterThan(before));
    expect(document.querySelector("[data-unsaved]")).toBeNull();
  });

  it("cancels back to what was saved", async () => {
    await open();
    await fireEvent.update(screen.getByLabelText(/Full name/), "Someone else");
    await fireEvent.click(within(document.querySelector("[data-profile-details]") as HTMLElement).getByRole("button", { name: "Cancel" }));
    expect((screen.getByLabelText(/Full name/) as HTMLInputElement).value).toBe("Ana Anić");
  });

  it("asks for a name before the server is asked", async () => {
    const { calls } = await open();
    await fireEvent.update(screen.getByLabelText(/Full name/), "");
    await fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    await settle();
    expect(screen.getByText("Required.")).toBeTruthy();
    expect(callsTo(calls, "PUT", "/v1/iam/profile")).toHaveLength(0);
  });
});

describe("the password", () => {
  const panel = () => within(document.querySelector("[data-profile-password]") as HTMLElement);

  it("catches a new password typed twice differently", async () => {
    const { calls } = await open();
    await fireEvent.update(panel().getByLabelText(/^Current password/), "old password");
    await fireEvent.update(panel().getByLabelText(/^New password/), "a new long password");
    await fireEvent.update(panel().getByLabelText(/^Repeat new password/), "another");
    await fireEvent.click(panel().getByRole("button", { name: "Change password" }));
    await settle();
    expect(panel().getByText("The passwords do not match.")).toBeTruthy();
    expect(callsTo(calls, "PUT", "/v1/iam/profile/password")).toHaveLength(0);
  });

  it("changes it with the three fields go-core asks for, then empties the form", async () => {
    const { calls } = await open({ "PUT /v1/iam/profile/password": jsonResponse(204) });
    await fireEvent.update(panel().getByLabelText(/^Current password/), "old password");
    await fireEvent.update(panel().getByLabelText(/^New password/), "a new long password");
    await fireEvent.update(panel().getByLabelText(/^Repeat new password/), "a new long password");
    await fireEvent.click(panel().getByRole("button", { name: "Change password" }));
    await waitFor(() => expect(callsTo(calls, "PUT", "/v1/iam/profile/password")).toHaveLength(1));
    expect(JSON.parse(String(callsTo(calls, "PUT", "/v1/iam/profile/password")[0]!.init.body))).toEqual({ current_password: "old password", new_password: "a new long password", new_password_confirmation: "a new long password" });
    expect(await screen.findByText("Password changed. You were signed out on your other devices.")).toBeTruthy();
    expect((panel().getByLabelText(/^Current password/) as HTMLInputElement).value).toBe("");
  });

  it("can show what was typed", async () => {
    await open();
    expect((panel().getByLabelText(/^New password/) as HTMLInputElement).type).toBe("password");
    await fireEvent.click(panel().getByRole("button", { name: "Show passwords" }));
    expect((panel().getByLabelText(/^New password/) as HTMLInputElement).type).toBe("text");
  });
});

describe("the sessions", () => {
  it("ends another device after asking, never this one", async () => {
    const { calls } = await open({ "DELETE /v1/iam/profile/sessions/8": jsonResponse(204) });
    await fireEvent.click(document.querySelector("[data-end-session='8']") as HTMLElement);
    await settle();
    await fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(callsTo(calls, "DELETE", "/v1/iam/profile/sessions/8")).toHaveLength(1));
  });
});
