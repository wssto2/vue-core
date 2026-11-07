import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { createLeaveGuard, leaveGuardKey } from "../form/leaveGuard";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import { mockMedia } from "../testing/media";
import { createPageChrome, pageChromeKey, usePageChrome } from "./chrome";
import WorkbenchPage from "./WorkbenchPage.vue";

const i18n = createTestI18n();
const view = defineComponent({ render: () => h("div") });
let media: ReturnType<typeof mockMedia>;
const original = window.matchMedia;

beforeEach(() => {
  media = mockMedia();
  // The panes sit side by side from `lg`; the mock answers every min-width as false, so a wide screen is stated here.
  const mocked = window.matchMedia;
  window.matchMedia = ((query: string) => (query.includes("64rem") ? ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList) : mocked(query))) as typeof window.matchMedia;
});
afterEach(() => {
  window.matchMedia = original;
  media.restore();
  document.body.innerHTML = "";
});

async function mountPage(props: Record<string, unknown> = {}, slots: Record<string, unknown> = {}) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/", component: view }, { path: "/templates", name: "templates", component: view }, { path: "/templates/1", component: view }] });
  await router.push("/templates/1");
  const chrome = createPageChrome();
  const guard = createLeaveGuard();
  const result = render(WorkbenchPage, {
    props: { title: "Base template", back: { label: "Templates", to: { name: "templates" } }, ...props },
    slots: Object.fromEntries(Object.entries({ start: "<p>code</p>", end: "<p>preview</p>", ...slots }).filter(([, slot]) => slot !== undefined)),
    global: { plugins: [i18n, testFormatting(i18n), router], provide: { [pageChromeKey as symbol]: chrome, [leaveGuardKey as symbol]: guard } },
  });
  return { ...result, chrome, guard, router };
}

describe("WorkbenchPage", () => {
  it("fills the viewport: a header, and two panes that do not scroll the page", async () => {
    const { container } = await mountPage({ description: "Template · saved today" }, { badges: "<span>Draft v4</span>" });
    const page = container.querySelector("[data-workbench-page]")!;
    expect(page.className).toContain("lg:h-[calc(100dvh");
    expect(page.className).toContain("lg:overflow-hidden");
    expect(page.className).not.toContain("max-w");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Base template");
    expect(screen.getByText("Template · saved today")).toBeTruthy();
    expect(screen.getByText("Draft v4")).toBeTruthy();
    expect(screen.getByText("code")).toBeTruthy();
    expect(screen.getByText("preview")).toBeTruthy();
    expect(screen.getByRole("separator")).toBeTruthy();
  });

  it("has the back link of every page shell, and tells the nav bar", async () => {
    const { chrome } = await mountPage();
    const back = document.querySelector<HTMLAnchorElement>("[data-page-back]")!;
    expect(back.textContent).toContain("Templates");
    expect(back.getAttribute("href")).toBe("/templates");
    expect(chrome.back.value).toEqual({ label: "Templates", to: { name: "templates" } });
  });

  it("shows the actions in the header, the overflow ones in the menu, and those a section registers", async () => {
    const calls: string[] = [];
    const Section = defineComponent({
      setup() {
        usePageChrome({ actions: () => [{ id: "publish", label: "Publish", placement: "primary", onClick: () => calls.push("publish") }] });
        return () => h("p", "section");
      },
    });
    await mountPage({ actions: [{ id: "versions", label: "Versions", onClick: () => calls.push("versions") }, { id: "delete", label: "Delete", placement: "overflow", onClick: () => {} }] }, { start: () => h(Section) });
    await fireEvent.click(screen.getByRole("button", { name: "Versions" }));
    await fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(calls).toEqual(["versions", "publish"]);
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.getByRole("button", { name: "More actions" })).toBeTruthy();
  });

  it("guards unsaved changes: the status and the leave question, only while dirty", async () => {
    const dirty = ref(false);
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/", component: view }] });
    await router.push("/");
    const guard = createLeaveGuard();
    const chrome = createPageChrome();
    render(defineComponent({ setup: () => () => h(WorkbenchPage, { title: "T", dirty: dirty.value }, { start: () => h("p", "code") }) }), {
      global: { plugins: [i18n, testFormatting(i18n), router], provide: { [pageChromeKey as symbol]: chrome, [leaveGuardKey as symbol]: guard } },
    });
    expect(guard.hasUnsavedChanges()).toBe(false);
    expect(screen.queryByText("Unsaved changes")).toBeNull();

    dirty.value = true;
    await nextTick();
    expect(guard.hasUnsavedChanges()).toBe(true);
    expect(screen.getByText("Unsaved changes")).toBeTruthy();

    dirty.value = false;
    await nextTick();
    expect(guard.hasUnsavedChanges()).toBe(false);
  });

  it("a page with only a start pane gives it the whole body", async () => {
    await mountPage({}, { end: undefined });
    expect(screen.queryByRole("separator")).toBeNull();
    expect(screen.getByText("code")).toBeTruthy();
  });

  it("releases the shell and clears the chrome when it leaves", async () => {
    const { chrome, unmount } = await mountPage();
    expect(chrome.hasShell.value).toBe(true);
    unmount();
    expect(chrome.hasShell.value).toBe(false);
    expect(chrome.back.value).toBeNull();
  });
});

