import { fireEvent, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import { mockMedia } from "../testing/media";
import { jsonResponse, routedTransport } from "../testing/transport";
import { backofficeShell } from "./backofficeShell";
import { toast } from "../overlay";
import { applyDarkMode, darkMode } from "./darkMode";
import { offlineNotice } from "./offlineNotice";
import { settle, signedIn, startShell, stopShells } from "./testing";

const user = { id: 1, name: "Ana Anić", email: "ana@example.com" };
let media: ReturnType<typeof mockMedia> | null = null;

beforeEach(() => {
  media = mockMedia({ narrow: false });
});
afterEach(() => {
  stopShells();
  media?.restore();
  document.documentElement.classList.remove("dark");
  document.head.querySelector('meta[name="theme-color"]')?.remove();
  vi.restoreAllMocks();
});

describe("darkMode", () => {
  const themeColor = () => document.head.querySelector('meta[name="theme-color"]')!.getAttribute("content");
  const withMeta = () => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = "#ffffff";
    document.head.append(meta);
  };

  it("applyDarkMode sets the class and the status bar colour", () => {
    withMeta();
    applyDarkMode(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(themeColor()).toBe("#18181B");
    applyDarkMode(false, { light: "#fafafa", dark: "#000000" });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(themeColor()).toBe("#fafafa");
  });

  it("puts the mode on the page and follows the preference", async () => {
    withMeta();
    const dark = ref(true);
    await startShell(backofficeShell(), { features: [darkMode({ dark: () => dark.value, set: () => undefined })], session: signedIn(1, [], { user }) });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(themeColor()).toBe("#18181B");

    dark.value = false;
    await nextTick();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(themeColor()).toBe("#ffffff");
  });

  it("adds a switch to the account menu that asks to store the opposite of the preference", async () => {
    const dark = ref(false);
    const set = vi.fn((value: boolean) => { dark.value = value; });
    await startShell(backofficeShell(), { features: [darkMode({ dark: () => dark.value, set })], session: signedIn(1, [], { user }) });

    await fireEvent.click(screen.getByRole("button", { name: /Ana Anić/ }));
    await settle();
    const row = screen.getByRole("switch", { name: "Dark mode" });
    expect(row.getAttribute("aria-checked")).toBe("false");

    await fireEvent.click(row);
    expect(set).toHaveBeenCalledWith(true);
    await settle();
    expect(screen.getByRole("switch", { name: "Dark mode" }).getAttribute("aria-checked")).toBe("true");
  });
});

describe("darkMode on the person's stored preferences", () => {
  const saved = (dark: boolean) => jsonResponse(200, { success: true, data: { preferences: { dark_mode: dark } } });

  it("puts the stored mode on the page without any option", async () => {
    await startShell(backofficeShell(), { features: [darkMode()], session: signedIn(1, [], { user, preferences: { dark_mode: true } }) });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("is light for a person with nothing stored", async () => {
    await startShell(backofficeShell(), { features: [darkMode()], session: signedIn(1, [], { user }) });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("saves the opposite through PUT /v1/auth/preferences when the switch is used, and follows the answer", async () => {
    const { transport, calls } = routedTransport({ "PUT /v1/auth/preferences": saved(true) });
    await startShell(backofficeShell(), { features: [darkMode()], session: signedIn(1, [], { user, preferences: { dark_mode: false, onboarding: { welcome_done: true } } }), platform: { transport } });

    await fireEvent.click(screen.getByRole("button", { name: /Ana Anić/ }));
    await settle();
    await fireEvent.click(screen.getByRole("switch", { name: "Dark mode" }));
    await settle();
    expect(calls.map((call) => JSON.parse(String(call.init.body)))).toEqual([{ preferences: { dark_mode: true } }]);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByRole("switch", { name: "Dark mode" }).getAttribute("aria-checked")).toBe("true");
  });

  it("goes back to the stored mode, with a toast, when the server refuses", async () => {
    const error = vi.spyOn(toast, "error");
    const { transport } = routedTransport({ "PUT /v1/auth/preferences": jsonResponse(500, { success: false, error: "boom" }) });
    await startShell(backofficeShell(), { features: [darkMode()], session: signedIn(1, [], { user, preferences: { dark_mode: false } }), platform: { transport } });

    await fireEvent.click(screen.getByRole("button", { name: /Ana Anić/ }));
    await settle();
    await fireEvent.click(screen.getByRole("switch", { name: "Dark mode" }));
    await settle();
    expect(error).toHaveBeenCalledOnce();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(screen.getByRole("switch", { name: "Dark mode" }).getAttribute("aria-checked")).toBe("false");
  });
});

describe("offlineNotice", () => {
  const notice = () => document.querySelector("[data-test='offline-notice']");

  it("shows a status while the browser is offline and clears when it is back", async () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await startShell(backofficeShell(), { features: [offlineNotice()] });
    expect(notice()!.textContent).toContain("No internet connection");
    expect(notice()!.getAttribute("role")).toBe("status");

    online.mockReturnValue(true);
    window.dispatchEvent(new Event("online"));
    await vi.waitFor(() => expect(notice()).toBeNull());
  });

  it("says nothing while online, and appears when the connection drops", async () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    await startShell(backofficeShell(), { features: [offlineNotice()] });
    expect(notice()).toBeNull();

    online.mockReturnValue(false);
    window.dispatchEvent(new Event("offline"));
    await vi.waitFor(() => expect(notice()).not.toBeNull());
  });
});
