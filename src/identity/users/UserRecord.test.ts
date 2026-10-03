import { fireEvent, screen, waitFor, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, settle } from "../../testing";
import { callsTo, dataOf, listOf, startScreen, stopApplications } from "../testing";

// The first screen of a file loads its route chunks through the transformer: slow on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

afterEach(stopApplications);

const person = (extra: object = {}) => ({
  id: 2, login: "ivan", name: "Ivan Horvat", email: "ivan@example.test", phone: "", locale: "en", active: true, status: "active",
  last_sign_in: "2026-10-01T08:30:00Z", locked_until: null, created_at: "2026-09-01T08:00:00Z", ...extra,
});
const session = (id: number, extra: object = {}) => ({ id, device: `Chrome on Mac ${id}`, ip: "10.0.0.1", opened_by: null, current: false, last_used_at: "2026-10-02T08:00:00Z", expires_at: "2026-10-03T08:00:00Z", created_at: "2026-10-01T08:00:00Z", ...extra });

const MANAGE = ["iam.user:view", "iam.user:manage"];

async function open(permissions: string[], { who = person(), section = "general", sessions = [session(11), session(12, { opened_by: { id: 1, name: "Ana Anić" } })], answers = {} as Parameters<typeof startScreen>[0]["answers"], user = { id: 1, name: "Ana" } } = {}) {
  return startScreen({
    permissions,
    user,
    location: `/users/2/${section}`,
    answers: {
      "GET /v1/iam/users/2": dataOf(who),
      "GET /v1/iam/users/1": dataOf(person({ id: 1, name: "Ana Anić", login: "ana" })),
      "GET /v1/iam/users/2/sessions": dataOf({ sessions }),
      ...answers,
    },
  });
}

describe("a person's record", () => {
  it("opens on the details, with the identity above the sections and the sessions counted", async () => {
    const { application, target } = await open(["iam.user:view"]);
    expect(application.router.currentRoute.value.name).toBe("users.record.general");
    expect(target.querySelector("[data-person-identity]")?.textContent).toContain("Ivan Horvat");
    expect(target.querySelector("[data-person-status]")?.textContent).toBe("Active");
    const nav = within(target.querySelector("nav[aria-label='Parts of the person']") as HTMLElement);
    for (const label of ["Basic details", "Sign-in", "Sessions", "Sign-in history", "Changes"]) expect(nav.getByText(label)).toBeTruthy();
  });

  it("shows the details as values to someone who may only look, without a Save", async () => {
    const { target } = await open(["iam.user:view"]);
    expect(target.textContent).toContain("ivan@example.test");
    expect(target.querySelector("input[type=email]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(target.querySelector("[data-deactivate-row]")).toBeNull();
  });

  it("saves the whole record from the toolbar and says so", async () => {
    const { calls } = await open(MANAGE, { answers: { "PUT /v1/iam/users/2": dataOf(person({ name: "Ivan H." })) } });
    await fireEvent.update(screen.getByLabelText(/Full name/), "Ivan H.");
    await fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(callsTo(calls, "PUT", "/v1/iam/users/2")).toHaveLength(1));
    expect(JSON.parse(String(callsTo(calls, "PUT", "/v1/iam/users/2")[0]!.init.body))).toEqual({ login: "ivan", name: "Ivan H.", email: "ivan@example.test", locale: "en" });
    expect(await screen.findByText("Details saved")).toBeTruthy();
  });
});

describe("deactivating and activating", () => {
  const deactivate = async () => {
    await fireEvent.click(document.querySelector("[data-deactivate-row] button") as HTMLElement);
    await settle();
  };

  it("says what it does, asks once, deactivates and reads the person again", async () => {
    let active = true;
    const { calls } = await open(MANAGE, { answers: { "POST /v1/iam/users/2/deactivate": () => ((active = false), jsonResponse(204)), "GET /v1/iam/users/2": () => dataOf(person(active ? {} : { active: false, status: "inactive" })) } });
    await deactivate();
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Signed out on every device (2)");
    expect(dialog.textContent).toContain("Can no longer sign in");
    await fireEvent.click(within(dialog).getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/iam/users/2/deactivate")).toHaveLength(1));
    await waitFor(() => expect(document.querySelector("[data-person-status]")?.textContent).toBe("Inactive"));
    expect(document.querySelector("[data-activate-row]")).not.toBeNull();
  });

  it("shows the reason when the application's hook refuses, and stays open", async () => {
    const { calls } = await open(MANAGE, {
      answers: { "POST /v1/iam/users/2/deactivate": jsonResponse(400, { success: false, error: "Ivan owns 3 open leads.", code: "crm.owns_leads", params: { count: 3 } }) },
    });
    await deactivate();
    await fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Deactivate" }));
    expect(await screen.findByText("Ivan owns 3 open leads.")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(callsTo(calls, "POST", "/v1/iam/users/2/deactivate")).toHaveLength(1);
  });

  it("does not offer deactivating one's own account", async () => {
    const { target } = await open(MANAGE, { who: person({ id: 1 }), user: { id: 1, name: "Ana" }, answers: { "GET /v1/iam/users/1": dataOf(person({ id: 1 })), "GET /v1/iam/users/1/sessions": dataOf({ sessions: [] }) } });
    await settle();
    expect(target.querySelector("[data-deactivate-row]")).toBeNull();
  });

  it("activates an inactive person after asking", async () => {
    const { calls } = await open(MANAGE, { who: person({ active: false, status: "inactive" }), answers: { "POST /v1/iam/users/2/activate": jsonResponse(204) } });
    await fireEvent.click(document.querySelector("[data-activate-row] button") as HTMLElement);
    await settle();
    await fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Activate" }));
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/iam/users/2/activate")).toHaveLength(1));
  });
});

describe("the sign-in section", () => {
  it("shows a lock, lifts it on request and reads the person again", async () => {
    let locked = true;
    const { calls } = await open(MANAGE, {
      section: "signin",
      who: person({ status: "locked", locked_until: "2026-10-03T14:35:00Z" }),
      answers: {
        "POST /v1/iam/users/2/unlock": () => ((locked = false), dataOf({ unlocked: true })),
        "GET /v1/iam/users/2": () => dataOf(locked ? person({ status: "locked", locked_until: "2026-10-03T14:35:00Z" }) : person()),
      },
    });
    expect(document.querySelector("[data-lock-row]")?.textContent).toContain("Sign-in is locked");
    await fireEvent.click(document.querySelector("[data-unlock]") as HTMLElement);
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/iam/users/2/unlock")).toHaveLength(1));
    await waitFor(() => expect(document.querySelector("[data-lock-row]")?.textContent).toContain("Sign-in is not locked"));
  });

  it("sets a new password, typed twice, without reading the old one", async () => {
    const { calls } = await open(MANAGE, { section: "signin", answers: { "PUT /v1/iam/users/2/password": jsonResponse(204) } });
    await fireEvent.click(document.querySelector("[data-set-password] button") as HTMLElement);
    await settle();
    const dialog = screen.getByRole("dialog");
    await fireEvent.update(within(dialog).getByLabelText(/^Password/), "a new long password");
    await fireEvent.update(within(dialog).getByLabelText(/Repeat password/), "a different one");
    await fireEvent.click(within(dialog).getByRole("button", { name: "Set password" }));
    await settle();
    expect(within(dialog).getByText("The passwords do not match.")).toBeTruthy();
    expect(callsTo(calls, "PUT", "/v1/iam/users/2/password")).toHaveLength(0);
    await fireEvent.update(within(dialog).getByLabelText(/Repeat password/), "a new long password");
    await fireEvent.click(within(dialog).getByRole("button", { name: "Set password" }));
    await waitFor(() => expect(callsTo(calls, "PUT", "/v1/iam/users/2/password")).toHaveLength(1));
    expect(JSON.parse(String(callsTo(calls, "PUT", "/v1/iam/users/2/password")[0]!.init.body))).toEqual({ password: "a new long password" });
  });

  it("offers signing in as the person to whoever holds the permission, and to nobody else", async () => {
    const withIt = await open([...MANAGE, "iam.user:impersonate"], { section: "signin" });
    expect(withIt.target.querySelector("[data-sign-in-as]")).not.toBeNull();
    stopApplications();
    const without = await open(MANAGE, { section: "signin" });
    expect(without.target.querySelector("[data-sign-in-as]")).toBeNull();
  });
});

describe("the sessions section", () => {
  it("lists the devices, marking who opened one by signing in as the person, with the name when it can be read", async () => {
    const { target } = await open(MANAGE, { section: "sessions" });
    expect(target.querySelector("[data-session='11']")?.textContent).toContain("Chrome on Mac 11");
    await waitFor(() => expect(target.querySelector("[data-session='12'] [data-session-opened-by]")?.textContent).toContain("Signed in as · Ana Anić"));
  });

  it("ends one session after asking, and all of them", async () => {
    const { calls } = await open(MANAGE, { section: "sessions", answers: { "DELETE /v1/iam/users/2/sessions/11": jsonResponse(204), "DELETE /v1/iam/users/2/sessions": jsonResponse(204) } });
    await fireEvent.click(document.querySelector("[data-end-session='11']") as HTMLElement);
    await settle();
    await fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(callsTo(calls, "DELETE", "/v1/iam/users/2/sessions/11")).toHaveLength(1));
    await settle();
    await fireEvent.click(document.querySelector("[data-end-all]") as HTMLElement);
    await settle();
    await fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Sign out everywhere" }));
    await waitFor(() => expect(callsTo(calls, "DELETE", "/v1/iam/users/2/sessions")).toHaveLength(1));
  });

  it("only lists one's own sessions: they are ended in the profile", async () => {
    const { target } = await open(MANAGE, { who: person({ id: 1, name: "Ana Anić" }), section: "sessions", answers: {} , user: { id: 1, name: "Ana" } });
    await settle();
    expect(target.querySelector("[data-end-all]")).toBeNull();
    expect(target.querySelector("[data-end-session]")).toBeNull();
  });

  it("gives someone who may only look no way to end a session", async () => {
    const { target } = await open(["iam.user:view"], { section: "sessions" });
    expect(target.querySelector("[data-session='11']")).not.toBeNull();
    expect(target.querySelector("[data-end-session]")).toBeNull();
  });
});

describe("the histories", () => {
  const signins = [
    { id: 1, event: "signed_in", ip: "10.0.0.1", device: "Chrome on Mac", actor: null, created_at: "2026-10-01T08:30:00Z" },
    { id: 2, event: "signed_in_as", ip: "10.0.0.9", device: "Firefox", actor: { id: 1, name: "Ana Anić" }, created_at: "2026-10-02T09:00:00Z" },
    { id: 3, event: "wrong_password", ip: "10.0.0.2", device: "", actor: null, created_at: "2026-10-02T10:00:00Z" },
  ];

  it("lists the sign-ins as badges, naming who signed in as the person", async () => {
    const { target } = await open(MANAGE, { section: "signins", answers: { "GET /v1/iam/users/2/signins": listOf(signins) } });
    expect(target.querySelector("[data-event='signed_in']")?.textContent).toBe("Signed in");
    expect(target.querySelector("[data-event='wrong_password']")?.textContent).toBe("Wrong password");
    await waitFor(() => expect(target.querySelector("[data-event='signed_in_as']")?.textContent).toBe("Signed in as · Ana Anić"));
  });

  it("says somebody else when the row's person is gone (an empty name), never a number", async () => {
    const gone = [{ ...signins[1]!, actor: { id: 99, name: "" } }];
    const { target } = await open(MANAGE, { section: "signins", answers: { "GET /v1/iam/users/2/signins": listOf(gone) } });
    await waitFor(() => expect(target.querySelector("[data-event='signed_in_as']")?.textContent).toBe("Signed in as"));
    expect(target.textContent).not.toContain("99");
  });

  it("filters the sign-ins by All / Failed, with the server's counts", async () => {
    const meta = { views: [{ key: "all", count: 3 }, { key: "failed", count: 1 }] };
    const { calls, target } = await open(MANAGE, { section: "signins", answers: { "GET /v1/iam/users/2/signins": () => listOf(signins, { meta }) } });
    const tab = await screen.findByRole("tab", { name: /Failed/ });
    expect(tab.textContent).toContain("1");
    expect(screen.getByRole("tab", { name: /All/ }).textContent).toContain("3");
    await fireEvent.click(tab);
    await waitFor(() => expect(callsTo(calls, "GET", "/v1/iam/users/2/signins").at(-1)!.url).toContain("view=failed"));
    expect(target.querySelector("[data-person-signins]")).not.toBeNull();
  });

  it("filters the changes by All / Access / Details, with the server's counts", async () => {
    const meta = { views: [{ key: "all", count: 5 }, { key: "access", count: 2 }, { key: "details", count: 3 }] };
    const { calls } = await open(MANAGE, { section: "changes", answers: { "GET /v1/iam/users/2/changes": () => listOf([], { meta }) } });
    const tab = await screen.findByRole("tab", { name: /Access/ });
    expect(tab.textContent).toContain("2");
    await fireEvent.click(tab);
    await waitFor(() => expect(callsTo(calls, "GET", "/v1/iam/users/2/changes").at(-1)!.url).toContain("view=access"));
  });

  it("pages the sign-ins", async () => {
    const { calls } = await open(MANAGE, { section: "signins", answers: { "GET /v1/iam/users/2/signins": () => listOf(signins, { total: 45, last_page: 3 }) } });
    await fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(callsTo(calls, "GET", "/v1/iam/users/2/signins").at(-1)!.url).toContain("page=2"));
  });

  it("lists the changes with who made them and what changed from what to what, never a password", async () => {
    const { target } = await open(MANAGE, {
      section: "changes",
      answers: {
        "GET /v1/iam/users/2/changes": listOf([
          { id: 1, action: "updated", fields: ["name", "phone"], before: { name: "Ivan", phone: "" }, after: { name: "Ivan Horvat", phone: "099" }, actor: { id: 1, name: "Ana Anić" }, created_at: "2026-10-02T09:00:00Z" },
          { id: 2, action: "password", fields: ["password"], before: {}, after: {}, actor: null, created_at: "2026-10-01T09:00:00Z" },
          { id: 3, action: "deactivated", fields: ["active"], before: { active: "true" }, after: { active: "false" }, actor: { id: 1, name: "Ana Anić" }, created_at: "2026-09-30T09:00:00Z" },
        ]),
      },
    });
    const rows = [...target.querySelectorAll("[data-change-row]")];
    expect(rows[0]!.textContent).toContain("Details changed");
    expect(rows[0]!.textContent).toContain("Full name: Ivan → Ivan Horvat");
    expect(rows[0]!.textContent).toContain("Phone number: — → 099");
    await waitFor(() => expect(rows[0]!.querySelector("[data-change-actor]")?.textContent).toBe("Ana Anić"));
    expect(rows[1]!.textContent).toContain("Password changed");
    expect(rows[1]!.querySelector("[data-change-actor]")).toBeNull(); // done by the person themselves
    expect(rows[2]!.textContent).not.toContain("true");
  });

  it("says so when nothing was changed yet", async () => {
    const { target } = await open(MANAGE, { section: "changes", answers: { "GET /v1/iam/users/2/changes": listOf([]) } });
    expect(target.querySelector("[data-changes-empty]")).not.toBeNull();
  });
});
