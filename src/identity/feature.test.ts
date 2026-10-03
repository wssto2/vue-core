import { fireEvent, screen, waitFor } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { createMemoryHistory } from "vue-router";
import { createApplication, defineFeature, type Application } from "../app";
import { page } from "../app/testing";
import { backofficeShell } from "../shell";
import { createPlatform, parseBootstrap } from "../platform";
import { jsonResponse, routedTransport, settle, type RecordedCall } from "../testing";
import fixture from "../../test-data/go-core/session_payload.json";
import { identityFeature } from "./feature";
import { identityPlatform } from "./session";

// The whole feature as an application installs it: guards, sign-in page, session, language.
const running: { application: Application; target: HTMLElement }[] = [];
afterEach(() => {
  for (const { application, target } of running.splice(0)) {
    application.dispose();
    target.remove();
  }
});

// go-core's payload, with an expiry that is still ahead so the session stays alive during the test.
const payload = { ...fixture, data: { ...fixture.data, expires_at: new Date(Date.now() + 3_600_000).toISOString() } };

async function start(signedIn: boolean, locale = "en") {
  let known = signedIn; // the server knows the session from the cookie; signing in sets it
  const answers = { "GET /api/v1/auth/me": () => (known ? jsonResponse(200, payload) : jsonResponse(401, { success: false, error: "no" })), "POST /api/v1/auth/refresh": jsonResponse(401, { success: false, error: "no" }), "POST /api/v1/auth/login": () => ((known = true), jsonResponse(200, payload)), "POST /api/v1/auth/change-locale": jsonResponse(204) };
  const { transport, calls } = routedTransport(answers);
  const platform = createPlatform({ config: parseBootstrap({ locale, app_name: "Test", api_base: "/api" }), transport, ...identityPlatform() });
  const history = createMemoryHistory();
  const application = createApplication({
    platform,
    shell: backofficeShell(),
    features: [identityFeature(), defineFeature({ id: "home", routes: [{ name: "home", path: "/", component: page("home page") }] })],
    router: { history },
    locale: { supported: ["en", "hr"], fallback: "en" },
    i18n: { missingWarn: false },
  });
  const target = document.createElement("div");
  document.body.append(target);
  running.push({ application, target });
  await application.mount(target);
  await settle();
  return { application, target, platform, calls };
}

const changes = (calls: readonly RecordedCall[]) => calls.filter((call) => call.url.endsWith("/auth/change-locale"));

describe("identityFeature", () => {
  it("sends a visitor to the sign-in page", async () => {
    const { application, target } = await start(false);
    expect(application.router.currentRoute.value.name).toBe("login");
    expect(target.querySelector("h1")?.textContent).toBe("Sign in to your account");
  });

  it("signs in on that page, goes home and speaks the person's language", async () => {
    const { application, calls } = await start(false);
    const answerMe = calls.length;
    await fireEvent.update(screen.getByLabelText(/Username/), "ana");
    await fireEvent.update(screen.getByLabelText(/Password/), "secret");
    await fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(application.router.currentRoute.value.name).toBe("home"));
    expect(application.locale.value).toBe("hr");
    expect(calls.length).toBeGreaterThan(answerMe);
  });

  it("applies the language the person saved, without saving it back", async () => {
    const { application, calls } = await start(true, "en"); // the user's locale in the fixture is hr
    expect(application.locale.value).toBe("hr");
    expect(changes(calls)).toHaveLength(0);
  });

  it("saves the language chosen in the menu, once", async () => {
    const { application, calls } = await start(true, "hr");
    await application.setLocale("en");
    await settle();
    const [call] = changes(calls);
    expect(changes(calls)).toHaveLength(1);
    expect(JSON.parse(String(call?.init.body))).toEqual({ locale: "en" });
  });
});
