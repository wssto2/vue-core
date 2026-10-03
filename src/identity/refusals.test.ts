import { fireEvent, screen, waitFor, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, settle } from "../testing";
import { callsTo, dataOf, listOf, refusal, startScreen, stopApplications } from "./testing";

// What the identity screens do with go-core's refusals (field errors, reasons) and with unsaved work.
vi.setConfig({ testTimeout: 30_000 });
afterEach(stopApplications);

const person = (extra: object = {}) => ({ id: 2, login: "ivan", name: "Ivan Horvat", email: "ivan@example.test", phone: "", locale: "en", active: true, status: "active", last_sign_in: null, locked_until: null, created_at: "2026-09-01T08:00:00Z", ...extra });
const profile = (extra: object = {}) => ({ id: 1, login: "ana", name: "Ana Anić", email: "ana@example.test", phone: "", locale: "en", created_at: "2026-09-01T08:00:00Z", pending_email: null, ...extra });
const pending = () => ({ email: "new@example.test", expires_at: new Date(Date.now() + 900_000).toISOString(), resend_available_at: new Date(Date.now() + 60_000).toISOString(), attempts_left: 5 });
const MANAGE = ["iam.user:view", "iam.user:manage"];
const fields = (map: Record<string, string>) => refusal(422, "validation_error", { fields: map });

const record = (answers: Parameters<typeof startScreen>[0]["answers"] = {}, permissions = MANAGE, section = "general") =>
  startScreen({ permissions, location: `/users/2/${section}`, answers: { "GET /v1/iam/users/2": dataOf(person()), "GET /v1/iam/users/2/sessions": dataOf({ sessions: [] }), ...answers } });

const mine = (answers: Parameters<typeof startScreen>[0]["answers"] = {}, who = profile()) =>
  startScreen({
    permissions: [],
    location: "/profile",
    answers: { "GET /v1/iam/profile": () => dataOf(who), "GET /v1/iam/profile/sessions": dataOf({ sessions: [] }), "GET /v1/iam/profile/signins": listOf([]), ...answers },
  });

describe("field errors from the server land on the fields", () => {
  it("of a person's details", async () => {
    await record({ "PUT /v1/iam/users/2": fields({ email: "identity.email.taken", login: "identity.login.invalid" }) });
    await fireEvent.update(screen.getByLabelText(/^E-mail/), "ana@example.test");
    await fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("This e-mail address is already used by another account.")).toBeTruthy();
    expect(screen.getByText("The username cannot be empty, contain spaces or be too long.")).toBeTruthy();
    expect((screen.getByLabelText(/^E-mail/) as HTMLInputElement).value).toBe("ana@example.test"); // the draft is kept
  });

  it("of a new user", async () => {
    await startScreen({ permissions: MANAGE, location: "/users", answers: { "GET /v1/iam/users": listOf([]), "POST /v1/iam/users": fields({ login: "identity.login.taken", password: "identity.password.weak" }) } });
    await fireEvent.click(screen.getByRole("button", { name: "New user" }));
    await settle();
    const dialog = within(screen.getByRole("dialog"));
    await fireEvent.update(dialog.getByLabelText(/Full name/), "Eva");
    await fireEvent.update(dialog.getByLabelText(/^Username/), "ana");
    await fireEvent.update(dialog.getByLabelText(/^E-mail/), "eva@example.test");
    await fireEvent.update(dialog.getByLabelText(/^Password/), "x");
    await fireEvent.update(dialog.getByLabelText(/Repeat password/), "x");
    await fireEvent.click(dialog.getByRole("button", { name: "Create user" }));
    expect(await dialog.findByText("This username is already taken.")).toBeTruthy();
    expect(dialog.getByText("The password does not meet the password rules.")).toBeTruthy();
  });

  it("of the password, under the field the server names", async () => {
    await mine({ "PUT /v1/iam/profile/password": fields({ current_password: "identity.password.wrong" }) });
    const panel = within(document.querySelector("[data-profile-password]") as HTMLElement);
    await fireEvent.update(panel.getByLabelText(/^Current password/), "wrong");
    await fireEvent.update(panel.getByLabelText(/^New password/), "a new long password");
    await fireEvent.update(panel.getByLabelText(/^Repeat new password/), "a new long password");
    await fireEvent.click(panel.getByRole("button", { name: "Change password" }));
    expect(await panel.findByText("The password is not correct.")).toBeTruthy();
    expect((panel.getByLabelText(/^New password/) as HTMLInputElement).value).toBe("a new long password");
  });

  it("of the e-mail change: a wrong password, and an address that is taken", async () => {
    await mine({ "POST /v1/iam/profile/email": fields({ current_password: "identity.password.wrong", email: "identity.email.taken" }) });
    await fireEvent.click(document.querySelector("[data-email-change]") as HTMLElement);
    await settle();
    const dialog = within(screen.getByRole("dialog"));
    await fireEvent.update(dialog.getByLabelText(/^New e-mail address/), "ivan@example.test");
    await fireEvent.update(dialog.getByLabelText(/^Current password/), "wrong");
    await fireEvent.click(dialog.getByRole("button", { name: "Send code" }));
    expect(await dialog.findByText("The password is not correct.")).toBeTruthy();
    expect(dialog.getByText("This e-mail address is already used by another account.")).toBeTruthy();
  });
});

describe("a refusal of the whole action says its reason", () => {
  it("when too many wrong passwords lock re-confirmation, with the time of day", async () => {
    await mine({ "PUT /v1/iam/profile/password": refusal(400, "identity.reauth.locked", { params: { retry_after: 900, locked_until: "2026-10-03T14:35:00Z" } }) });
    const panel = within(document.querySelector("[data-profile-password]") as HTMLElement);
    await fireEvent.update(panel.getByLabelText(/^Current password/), "wrong");
    await fireEvent.update(panel.getByLabelText(/^New password/), "a new long password");
    await fireEvent.update(panel.getByLabelText(/^Repeat new password/), "a new long password");
    await fireEvent.click(panel.getByRole("button", { name: "Change password" }));
    const text = (await screen.findByText(/Too many wrong passwords\. For your security, try again after/)).textContent ?? "";
    expect(text).not.toContain("2026-10-03T14:35:00Z"); // a time of day, not the wire format
    expect(text).toMatch(/after \d{1,2}:\d{2}/);
  });

  it("when a person tries to deactivate their own account", async () => {
    await record({ "POST /v1/iam/users/2/deactivate": refusal(400, "identity.account.self_deactivation") });
    await fireEvent.click(document.querySelector("[data-deactivate-row] button") as HTMLElement);
    await settle();
    await fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Deactivate" }));
    expect(await screen.findByText("You cannot deactivate your own account.")).toBeTruthy();
  });

  it("when the application's deactivation hook refuses: the server's words, or the application's own text for the reason", async () => {
    const refuse = { "POST /v1/iam/users/2/deactivate": jsonResponse(400, { success: false, error: "Ivan still owns 3 open leads.", code: "crm.owns_leads", params: { count: 3 } }) };
    const attempt = async () => {
      await fireEvent.click(document.querySelector("[data-deactivate-row] button") as HTMLElement);
      await settle();
      await fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Deactivate" }));
    };
    await record(refuse);
    await attempt();
    expect(await screen.findByText("Ivan still owns 3 open leads.")).toBeTruthy();
    stopApplications();
    await startScreen({
      permissions: MANAGE,
      location: "/users/2/general",
      messages: { en: { errors: { crm: { owns_leads: "Reassign their {count} open leads first." } } } },
      answers: { "GET /v1/iam/users/2": dataOf(person()), "GET /v1/iam/users/2/sessions": dataOf({ sessions: [] }), ...refuse },
    });
    await attempt();
    expect(await screen.findByText("Reassign their 3 open leads first.")).toBeTruthy();
  });

  it("when a code is wrong: the boxes clear and the attempts left are said", async () => {
    await mine({
      "POST /v1/iam/profile/email": dataOf(pending()),
      "POST /v1/iam/profile/email/confirm": jsonResponse(422, { success: false, error: "x", code: "identity.code.mismatch", params: { attempts_left: 4 } }),
    });
    await fireEvent.click(document.querySelector("[data-email-change]") as HTMLElement);
    await settle();
    await fireEvent.update(within(screen.getByRole("dialog")).getByLabelText(/^New e-mail address/), "new@example.test");
    await fireEvent.update(within(screen.getByRole("dialog")).getByLabelText(/^Current password/), "my password");
    await fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Send code" }));
    await settle();
    await fireEvent.update(document.querySelector("[data-test='otp-input-field']") as HTMLInputElement, "000000");
    expect(await within(screen.getByRole("dialog")).findByText("The code is not correct. Attempts left: 4.")).toBeTruthy();
    expect((document.querySelector("[data-test='otp-input-field']") as HTMLInputElement).value).toBe("");
  });

  it("when the address was taken before the code was confirmed: back to the address, with the reason on the field", async () => {
    await mine({
      "POST /v1/iam/profile/email": dataOf(pending()),
      "POST /v1/iam/profile/email/confirm": fields({ email: "identity.email.taken" }),
    });
    await fireEvent.click(document.querySelector("[data-email-change]") as HTMLElement);
    await settle();
    await fireEvent.update(within(screen.getByRole("dialog")).getByLabelText(/^New e-mail address/), "new@example.test");
    await fireEvent.update(within(screen.getByRole("dialog")).getByLabelText(/^Current password/), "my password");
    await fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Send code" }));
    await settle();
    await fireEvent.update(document.querySelector("[data-test='otp-input-field']") as HTMLInputElement, "123456");
    expect(await within(screen.getByRole("dialog")).findByLabelText(/^New e-mail address/)).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByText("This e-mail address is already used by another account.")).toBeTruthy();
  });
});

describe("unsaved work is not lost by accident", () => {
  const leave = async (application: Awaited<ReturnType<typeof record>>["application"]) => {
    const going = application.router.push("/");
    await settle();
    return going;
  };

  it("on a person's details", async () => {
    const { application } = await record();
    await fireEvent.update(screen.getByLabelText(/Full name/), "Someone else");
    const going = leave(application);
    expect(await screen.findByText("Unsaved changes")).toBeTruthy();
    await settle();
    await fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));
    await going;
    expect(application.router.currentRoute.value.name).toBe("users.record.general");
  });

  it("on the profile's details, and leaving goes through once they are discarded", async () => {
    const { application } = await mine();
    await fireEvent.update(screen.getByLabelText(/Full name/), "Someone else");
    const going = leave(application);
    expect(await screen.findByText("Unsaved changes")).toBeTruthy();
    await settle();
    await fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await going;
    await waitFor(() => expect(application.router.currentRoute.value.name).toBe("home"));
  });

  it("in the new-user dialog: closing it with typed input asks first", async () => {
    await startScreen({ permissions: MANAGE, location: "/users", answers: { "GET /v1/iam/users": listOf([]) } });
    await fireEvent.click(screen.getByRole("button", { name: "New user" }));
    await settle();
    await fireEvent.update(within(screen.getByRole("dialog")).getByLabelText(/Full name/), "Eva");
    await fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Unsaved changes")).toBeTruthy();
  });

  it("never when nothing was typed", async () => {
    const { application } = await mine();
    await leave(application);
    expect(screen.queryByText("Unsaved changes")).toBeNull();
    expect(application.router.currentRoute.value.name).toBe("home");
  });
});

it("a refused call is counted once", async () => {
  const { calls } = await record({ "PUT /v1/iam/users/2": fields({ email: "identity.email.taken" }) });
  await fireEvent.update(screen.getByLabelText(/^E-mail/), "ana@example.test");
  await fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("This e-mail address is already used by another account.");
  expect(callsTo(calls, "PUT", "/v1/iam/users/2")).toHaveLength(1);
});
