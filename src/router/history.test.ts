import { describe, expect, it } from "vitest";
import { createRouter } from "vue-router";
import { createAppHistory, createReplaceOnlyHistory, isIosHomeScreenApp } from "./history";

const view = { render: () => null };

describe("history", () => {
  it("detects the iOS home-screen app by navigator.standalone", () => {
    expect(isIosHomeScreenApp({ standalone: true } as unknown as Navigator)).toBe(true);
    expect(isIosHomeScreenApp({ standalone: false } as unknown as Navigator)).toBe(false);
    expect(isIosHomeScreenApp({} as Navigator)).toBe(false);
  });

  it("replace-only history follows the URL but never adds an entry behind it", async () => {
    const history = createReplaceOnlyHistory();
    const router = createRouter({ history, routes: [{ path: "/", component: view }, { path: "/a", component: view }, { path: "/b", component: view }] });
    await router.push("/");
    const entries = window.history.length;

    await router.push("/a");
    await router.push("/b");

    expect(window.location.pathname).toBe("/b");
    expect(window.history.length).toBe(entries);
    history.destroy();
  });

  it("outside the home-screen app the history is the plain web history", async () => {
    const history = createAppHistory();
    const router = createRouter({ history, routes: [{ path: "/", component: view }, { path: "/a", component: view }] });
    await router.push("/");
    const entries = window.history.length;

    await router.push("/a");

    expect(window.history.length).toBe(entries + 1);
    history.destroy();
  });
});
