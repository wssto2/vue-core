import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The install prompt keeps module state (the event fires once, before any component): a fresh module per test.
async function load() {
  vi.resetModules();
  return import("./index");
}

function fakeNavigator(values: Record<string, unknown>) {
  vi.stubGlobal("navigator", { userAgent: "", platform: "", maxTouchPoints: 0, ...values });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("currentPlatform and isStandalone", () => {
  it("tells iOS (including an iPad asking for the desktop site), Android and the rest apart", async () => {
    const { currentPlatform } = await load();

    fakeNavigator({ userAgent: "Mozilla/5.0 (Linux; Android 14)" });
    expect(currentPlatform()).toBe("android");
    fakeNavigator({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)" });
    expect(currentPlatform()).toBe("ios");
    fakeNavigator({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 5 });
    expect(currentPlatform()).toBe("ios");
    fakeNavigator({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 0 });
    expect(currentPlatform()).toBe("desktop");
    vi.unstubAllGlobals();
    expect(currentPlatform()).toBe("desktop");
  });

  it("is standalone by the display mode or by Safari's flag", async () => {
    const { isStandalone } = await load();

    window.matchMedia = ((query: string) => ({ matches: query === "(display-mode: standalone)" })) as typeof window.matchMedia;
    expect(isStandalone()).toBe(true);
    window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
    expect(isStandalone()).toBe(false);
    fakeNavigator({ standalone: true });
    expect(isStandalone()).toBe(true);
  });
});

describe("install prompt", () => {
  function promptEvent(outcome: "accepted" | "dismissed") {
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    event.prompt = vi.fn(async () => {});
    event.userChoice = Promise.resolve({ outcome });
    return event;
  }

  beforeEach(() => {
    window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
  });

  it("keeps the event once captured, and opens the dialog from a button", async () => {
    const { captureInstallPrompt, useInstallPrompt } = await load();
    captureInstallPrompt();
    captureInstallPrompt(); // a second call adds no second listener
    const { canInstall, installed, install } = useInstallPrompt();

    expect(canInstall.value).toBe(false);
    expect(await install()).toBe(false);

    const event = promptEvent("accepted");
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(canInstall.value).toBe(true);

    expect(await install()).toBe(true);
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(canInstall.value).toBe(false);
    expect(installed.value).toBe(true);
  });

  it("a dismissed dialog consumes the event and installs nothing", async () => {
    const { captureInstallPrompt, useInstallPrompt } = await load();
    captureInstallPrompt();
    const { canInstall, installed, install } = useInstallPrompt();

    window.dispatchEvent(promptEvent("dismissed"));
    expect(await install()).toBe(false);
    expect(canInstall.value).toBe(false);
    expect(installed.value).toBe(false);
  });

  it("appinstalled marks it installed and drops the event", async () => {
    const { captureInstallPrompt, useInstallPrompt } = await load();
    captureInstallPrompt();
    const { canInstall, installed } = useInstallPrompt();

    window.dispatchEvent(promptEvent("accepted"));
    window.dispatchEvent(new Event("appinstalled"));
    expect(canInstall.value).toBe(false);
    expect(installed.value).toBe(true);
  });
});

describe("registerServiceWorker", () => {
  const register = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    register.mockClear();
    fakeNavigator({ serviceWorker: { register } });
    // happy-dom would try to load a real <script src>.
    vi.spyOn(document, "querySelector").mockReturnValue({ src: "/assets/main-3f9a.js" } as HTMLScriptElement);
  });

  it("registers /sw.js with the build entry as a cache-buster, once the page has loaded", async () => {
    const { registerServiceWorker } = await load();
    vi.spyOn(document, "readyState", "get").mockReturnValue("loading");

    registerServiceWorker();
    expect(register).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("load"));
    expect(register).toHaveBeenCalledWith("/sw.js?build=%2Fassets%2Fmain-3f9a.js");
  });

  it("registers at once when the page has already loaded, at the url given", async () => {
    const { registerServiceWorker } = await load();
    vi.spyOn(document, "readyState", "get").mockReturnValue("complete");

    registerServiceWorker({ url: "/app/worker.js" });
    expect(register).toHaveBeenCalledWith("/app/worker.js?build=%2Fassets%2Fmain-3f9a.js");
  });

  it("says unknown without a build entry, and joins an existing query with &", async () => {
    const { registerServiceWorker } = await load();
    vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
    vi.spyOn(document, "querySelector").mockReturnValue(null);

    registerServiceWorker({ url: "/sw.js?v=2" });
    expect(register).toHaveBeenCalledWith("/sw.js?v=2&build=unknown");
  });

  it("does nothing when disabled or without service worker support, and a refusal is silent", async () => {
    const { registerServiceWorker } = await load();
    vi.spyOn(document, "readyState", "get").mockReturnValue("complete");

    registerServiceWorker({ enabled: false });
    fakeNavigator({});
    registerServiceWorker();
    expect(register).not.toHaveBeenCalled();

    fakeNavigator({ serviceWorker: { register: () => Promise.reject(new Error("blocked")) } });
    expect(() => registerServiceWorker()).not.toThrow();
  });
});
