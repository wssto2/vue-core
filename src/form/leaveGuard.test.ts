import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, ref, type App } from "vue";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { MissingContextError } from "../platform/context";
import { createTestI18n } from "../testing/i18n";
import { createLeaveGuard, leaveGuardKey, useLeaveGuard } from "./leaveGuard";
import LeaveGuardRoot from "./LeaveGuardRoot.vue";
import { settle, withSetup } from "./testing";

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
});

/** An app with a router, the leave guard and its dialog, and a first page with a switchable dirty flag. */
async function openApp(pages: { dirty: () => boolean }[] = []) {
  const guard = createLeaveGuard();
  const dirty = ref(false);
  const Editor = defineComponent({
    setup() {
      useLeaveGuard(() => dirty.value);
      for (const page of pages) useLeaveGuard(page.dirty);
      return () => h("p", "editor");
    },
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/editor", component: Editor },
      { path: "/elsewhere", component: defineComponent({ render: () => h("p", "elsewhere") }) },
    ],
  });
  await router.push("/editor");
  const plugin = { install: (app: App) => app.provide(leaveGuardKey, guard) };
  const view = render(defineComponent({ render: () => h("div", [h(RouterView), h(LeaveGuardRoot)]) }), { global: { plugins: [router, createTestI18n("en"), plugin] } });
  return { guard, dirty, router, view };
}

describe("the leave guard", () => {
  it("lets a clean page go without asking", async () => {
    const { router } = await openApp();
    await router.push("/elsewhere");
    expect(router.currentRoute.value.path).toBe("/elsewhere");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("asks before a dirty page is left; Continue editing keeps the user there", async () => {
    const { router, dirty } = await openApp();
    dirty.value = true;
    const navigation = router.push("/elsewhere");
    await settle();
    expect(screen.getByRole("alertdialog").textContent).toContain("Unsaved changes");
    await fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));
    await navigation;
    expect(router.currentRoute.value.path).toBe("/editor");
  });

  it("Discard changes lets the user go", async () => {
    const { router, dirty } = await openApp();
    dirty.value = true;
    const navigation = router.push("/elsewhere");
    await settle();
    await fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await navigation;
    expect(router.currentRoute.value.path).toBe("/elsewhere");
  });

  it("Escape keeps the user on the page", async () => {
    const { router, dirty } = await openApp();
    dirty.value = true;
    const navigation = router.push("/elsewhere");
    await settle();
    await fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    await navigation;
    expect(router.currentRoute.value.path).toBe("/editor");
  });

  it("asks once for a navigation that two dirty forms both object to", async () => {
    const { router, dirty } = await openApp([{ dirty: () => true }]);
    dirty.value = true;
    const navigation = router.push("/elsewhere");
    await settle();
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
    await fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await navigation;
    expect(router.currentRoute.value.path).toBe("/elsewhere");
  });
});

describe("the leave guard's answers", () => {
  it("shares one open dismissal question between two sheets asking at once (ARV replaced the first, which then never settled)", async () => {
    const guard = createLeaveGuard();
    const first = guard.confirm();
    const second = guard.confirm();
    guard.pending.value?.resolve(true);
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(guard.pending.value).toBeNull();
  });

  it("a newer navigation answers the older unanswered one with stay", async () => {
    const guard = createLeaveGuard();
    const older = guard.confirm({ path: "/a" } as never);
    const newer = guard.confirm({ path: "/b" } as never);
    expect(await older).toBe(false);
    guard.pending.value?.resolve(true);
    expect(await newer).toBe(true);
  });

  it("reports unsaved changes of the pages that registered, until they unmount", async () => {
    const guard = createLeaveGuard();
    const release = guard.register(() => true);
    expect(guard.hasUnsavedChanges()).toBe(true);
    release();
    expect(guard.hasUnsavedChanges()).toBe(false);
  });

  it("is per app: two guards share nothing", () => {
    const one = createLeaveGuard();
    const two = createLeaveGuard();
    one.register(() => true);
    expect(two.hasUnsavedChanges()).toBe(false);
  });

  it("asks the browser before the tab closes while dirty, and not when clean", async () => {
    const guard = createLeaveGuard();
    const dirty = ref(true);
    const { unmount } = withSetup(() => useLeaveGuard(() => dirty.value), [{ install: (app: App) => app.provide(leaveGuardKey, guard) }]);
    await nextTick();
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    dirty.value = false;
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    unmount();
  });

  it("confirmDiscard answers true without asking when nothing is dirty", async () => {
    const guard = createLeaveGuard();
    const { result } = withSetup(() => useLeaveGuard(() => false), [{ install: (app: App) => app.provide(leaveGuardKey, guard) }]);
    expect(await result.confirmDiscard()).toBe(true);
    expect(guard.pending.value).toBeNull();
  });

  it("fails with an actionable error when the app installed no leave guard", () => {
    expect(() => withSetup(() => useLeaveGuard(() => false))).toThrow(MissingContextError);
  });
});
