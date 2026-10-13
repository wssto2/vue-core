import { fireEvent, screen, waitFor } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { createMemoryHistory } from "vue-router";
import { createApplication, defineFeature, type Application } from "../app";
import { createPlatform, parseBootstrap } from "../platform";
import { backofficeShell } from "../shell";
import { jsonResponse, routedTransport, settle, type Answer, type RecordedCall } from "../testing";
import fixture from "../../test-data/go-core/session_payload.json";
import { identityFeature } from "./feature";
import { identityPlatform } from "./session";
import { toast } from "../overlay";
import { CLOSE_OVERLAYS_EVENT } from "../overlay/closeOverlays";
import SignInAsButton from "./SignInAsButton.vue";

// The screens that show when the session ends mid-work, and while somebody is signed in as another person.
const running: { application: Application; target: HTMLElement }[] = [];
afterEach(() => {
  for (const { application, target } of running.splice(0)) {
    application.dispose();
    target.remove();
  }
});

const future = () => new Date(Date.now() + 3_600_000).toISOString();
const payloadOf = (id: number, name: string, extra: object = {}, permissions: string[] = []) => ({
  success: true,
  data: {
    ...fixture.data,
    user: { id, login: name.toLowerCase(), name, email: `${name.toLowerCase()}@example.test`, locale: "en" },
    expires_at: future(),
    access: { ...fixture.data.access, permissions: { ...fixture.data.access.permissions, ...Object.fromEntries(permissions.map((p) => [p, fixture.data.access.permissions["tickets.ticket:view"]])) } },
    ...extra,
  },
});

// A page with a draft in it: an input whose text only lives in the page.
const Draft = defineComponent({ setup: () => { const text = ref(""); return () => h("input", { "data-draft": "", value: text.value, onInput: (e: Event) => (text.value = (e.target as HTMLInputElement).value) }); } });
const Person = defineComponent({ render: () => h(SignInAsButton, { userId: 2, name: "Ivan", permission: "iam.user:impersonate" }) });

async function start(initial: ReturnType<typeof payloadOf>, location = "/draft", own = initial, answers: Record<string, Answer> = {}) {
  const server = { me: initial as ReturnType<typeof payloadOf> | null, refresh: false };
  const { transport, calls } = routedTransport({
    "GET /api/v1/auth/me": () => (server.me ? jsonResponse(200, server.me) : jsonResponse(401, { success: false, error: "no", code: "identity.session.invalid" })),
    "POST /api/v1/auth/refresh": () => jsonResponse(401, { success: false, error: "no", code: "identity.session.invalid" }),
    "POST /api/v1/auth/login": (call: RecordedCall) => {
      const { password } = JSON.parse(String(call.init.body));
      if (password !== "secret") return jsonResponse(422, { success: false, error: "x", code: "identity.signin.failed" });
      server.me = initial;
      return jsonResponse(200, initial);
    },
    "POST /api/v1/auth/logout": () => jsonResponse(204),
    "POST /api/v1/auth/login-as": () => (server.me === null ? jsonResponse(401, { success: false, error: "no", code: "identity.session.invalid" }) : ((server.me = payloadOf(2, "Ivan", { impersonator: { id: 1, name: "Ana" } })), jsonResponse(200, server.me))),
    "POST /api/v1/auth/login-as/return": () => ((server.me = own), jsonResponse(200, own)),
    "POST /api/v1/auth/change-locale": jsonResponse(204),
    ...answers,
  });
  const platform = createPlatform({ config: parseBootstrap({ locale: "en", app_name: "Test", api_base: "/api" }), transport, ...identityPlatform() });
  const history = createMemoryHistory();
  history.replace(location);
  const application = createApplication({
    platform,
    shell: backofficeShell(),
    features: [identityFeature(), defineFeature({ id: "pages", routes: [{ name: "home", path: "/", component: { render: () => h("p", "home page") } }, { name: "draft", path: "/draft", component: Draft }, { name: "person", path: "/person", component: Person }] })],
    router: { history },
    i18n: { missingWarn: false },
  });
  const target = document.createElement("div");
  document.body.append(target);
  running.push({ application, target });
  await application.mount(target);
  await settle();
  return { application, target, platform, server, calls };
}

const draft = () => document.querySelector<HTMLInputElement>("[data-draft]")!;
const dialog = () => document.querySelector("[data-session-expiry]");

describe("a session that ends in the middle of work", () => {
  it("asks for the password in a dialog over the page, which keeps its draft, and goes on once signed in", async () => {
    const { application, platform } = await start(payloadOf(1, "Ana"));
    await fireEvent.update(draft(), "half a sentence");
    platform.session.expire();
    await settle();

    expect(application.router.currentRoute.value.name).toBe("draft"); // not sent to the login page
    expect(dialog()?.textContent).toContain("Your session has ended");
    expect(document.querySelector("[data-expiry-login]")?.textContent).toBe("ana");
    expect(draft().value).toBe("half a sentence");

    await fireEvent.update(screen.getByLabelText(/Password/), "wrong");
    await fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Invalid username or password.")).toBeTruthy();
    expect(dialog()).not.toBeNull();

    await fireEvent.update(screen.getByLabelText(/Password/), "secret");
    await fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(dialog()).toBeNull());
    expect(draft().value).toBe("half a sentence");
    expect(application.router.currentRoute.value.name).toBe("draft");
    expect(platform.session.state.value.status).toBe("authenticated");
  });

  it("cannot be dismissed with Escape", async () => {
    const { platform } = await start(payloadOf(1, "Ana"));
    platform.session.expire();
    await settle();
    await fireEvent.keyDown(document, { key: "Escape" });
    await settle();
    expect(dialog()).not.toBeNull();
  });

  it("lets the person sign out instead, which goes to the sign-in page", async () => {
    const { application, platform, server } = await start(payloadOf(1, "Ana"));
    platform.session.expire();
    await settle();
    server.me = null;
    await fireEvent.click(screen.getByRole("button", { name: "Sign out instead" }));
    await waitFor(() => expect(application.router.currentRoute.value.name).toBe("login"));
    expect(dialog()).toBeNull();
  });

  it("is not asked while somebody is signed in as another person: it is the sign-in page", async () => {
    const { application, platform } = await start(payloadOf(2, "Ivan", { impersonator: { id: 1, name: "Ana" } }));
    platform.session.expire();
    await waitFor(() => expect(application.router.currentRoute.value.name).toBe("login"));
    expect(dialog()).toBeNull();
  });
});

describe("signed in as somebody else", () => {
  it("shows no banner in one's own session", async () => {
    await start(payloadOf(1, "Ana"));
    expect(document.querySelector("[data-impersonation-banner]")).toBeNull();
  });

  it("shows the banner with the way back, which returns to one's own account on the home page", async () => {
    const { application, platform, calls } = await start(payloadOf(2, "Ivan", { impersonator: { id: 1, name: "Ana" } }), "/draft", payloadOf(1, "Ana"));
    const banner = document.querySelector("[data-impersonation-banner]");
    expect(banner?.textContent).toContain("You are signed in as Ivan");
    expect(banner?.className).toContain("sticky"); // it stays in view while the page scrolls
    expect(banner?.querySelector("button")).not.toBeNull();
    expect(banner?.querySelector("[aria-label],[data-dismiss]")).toBeNull(); // not dismissible: the only control is the way back

    await fireEvent.click(screen.getByRole("button", { name: "Return to my account" }));
    await settle();
    expect(calls.some((call) => call.method === "POST" && call.url.endsWith("/auth/login-as/return"))).toBe(true);
    expect(platform.session.state.value).toMatchObject({ status: "authenticated", user: { id: 1 } });
    expect(document.querySelector("[data-impersonation-banner]")).toBeNull();
    expect(application.router.currentRoute.value.name).toBe("home");
  });

  it("offers `sign in as` only to whoever holds the permission, and signs in as them under the banner", async () => {
    const withPermission = await start(payloadOf(1, "Ana", {}, ["iam.user:impersonate"]), "/person");
    await fireEvent.click(screen.getByRole("button", { name: "Sign in as Ivan" }));
    await waitFor(() => expect(withPermission.application.router.currentRoute.value.name).toBe("home"));
    await waitFor(() => expect(document.querySelector("[data-impersonation-banner]")).not.toBeNull());
    expect(document.querySelector("[data-sign-in-as]")).toBeNull(); // no nesting: the button is gone on the way
  });

  it("does not offer it without the permission", async () => {
    await start(payloadOf(1, "Ana"), "/person");
    expect(document.querySelector("[data-sign-in-as]")).toBeNull();
  });
});

describe("the prompt of an expired session", () => {
  it("closes the menus and popovers that are open when it appears", async () => {
    const { platform } = await start(payloadOf(1, "Ana"));
    let closed = 0;
    const onClose = () => closed++;
    document.addEventListener(CLOSE_OVERLAYS_EVENT, onClose);
    platform.session.expire();
    await settle();
    document.removeEventListener(CLOSE_OVERLAYS_EVENT, onClose);
    expect(closed).toBe(1);
    expect(dialog()).not.toBeNull();
  });
});

describe("a request that fails because the session ended", () => {
  it("shows no toast over the prompt that already says so", async () => {
    const { platform, server } = await start(payloadOf(1, "Ana", {}, ["iam.user:impersonate"]), "/person");
    const error = vi.spyOn(toast, "error");
    const dismiss = vi.spyOn(toast, "dismiss");
    server.me = null; // the server revoked it: the click's own request answers 401, and renewing fails
    platform.session.expire();
    await settle();
    expect(dismiss).toHaveBeenCalled(); // what was on screen when the prompt opened is gone
    await fireEvent.click(screen.getByRole("button", { name: "Sign in as Ivan" }), {});
    await settle();
    expect(error).not.toHaveBeenCalled();
    expect(dialog()).not.toBeNull();
    error.mockRestore();
    dismiss.mockRestore();
  });
});

const refused = (status: number, code: string) => jsonResponse(status, { success: false, error: "", code });

describe("a refused sign in as", () => {
  it.each([
    [400, "identity.account.inactive", "This account is not active."],
    [403, "identity.impersonation.disabled", "Signing in as another person is not enabled."],
    [403, "authz.forbidden", "You are not allowed to make this change in that place."],
  ])("says why: %s %s", async (status, code, sentence) => {
    await start(payloadOf(1, "Ana", {}, ["iam.user:impersonate"]), "/person", undefined, { "POST /api/v1/auth/login-as": refused(status, code) });
    const error = vi.spyOn(toast, "error");
    await fireEvent.click(screen.getByRole("button", { name: "Sign in as Ivan" }));
    await settle();
    expect(error).toHaveBeenCalledWith(sentence);
    error.mockRestore();
  });

  it("says a general sentence when the server gives no reason", async () => {
    await start(payloadOf(1, "Ana", {}, ["iam.user:impersonate"]), "/person", undefined, { "POST /api/v1/auth/login-as": jsonResponse(422, { success: false }) });
    const error = vi.spyOn(toast, "error");
    await fireEvent.click(screen.getByRole("button", { name: "Sign in as Ivan" }));
    await settle();
    expect(error).toHaveBeenCalledWith("You cannot sign in as Ivan.");
    error.mockRestore();
  });
});

describe("returning to one's own account", () => {
  it("is a row of the account menu while signed in as somebody else, and does what the banner does", async () => {
    const { application, calls } = await start(payloadOf(2, "Ivan", { impersonator: { id: 1, name: "Ana" } }), "/draft", payloadOf(1, "Ana"));
    await fireEvent.click(screen.getByRole("button", { name: /Ivan/ }));
    await settle();
    expect(document.querySelector("[data-return-menu-item]")).not.toBeNull();
    await fireEvent.click(document.querySelector("[data-return-menu-item] button") as HTMLElement);
    await settle();
    expect(calls.filter((call) => call.url.endsWith("/auth/login-as/return"))).toHaveLength(1);
    expect(application.router.currentRoute.value.name).toBe("home");
  });

  it("is not in the menu in one's own session", async () => {
    await start(payloadOf(1, "Ana"));
    await fireEvent.click(screen.getByRole("button", { name: /Ana/ }));
    await settle();
    expect(document.querySelector("[data-return-menu-item]")).toBeNull();
  });
});

describe("the language switch", () => {
  it("says so when the server does not support the language, and goes back to the saved one", async () => {
    const { application } = await start(payloadOf(1, "Ana"), "/draft", undefined, { "POST /api/v1/auth/change-locale": refused(422, "identity.locale.unsupported") });
    const error = vi.spyOn(toast, "error");
    await application.setLocale("hr");
    await settle();
    expect(error).toHaveBeenCalledWith("Ovaj jezik nije dostupan za vaš korisnički račun.") // said in the language they chose;
    expect(application.locale.value).toBe("en");
    error.mockRestore();
  });
});
