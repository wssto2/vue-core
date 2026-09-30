import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { MissingContextError } from "../platform/context";
import { createTestI18n } from "../testing/i18n";
import { mockMedia } from "../testing/media";
import AdaptivePageShell from "./AdaptivePageShell.vue";
import BottomDock from "./BottomDock.vue";
import { bottomDockKey } from "./bottomDock";
import BottomDockPortal from "./BottomDockPortal.vue";
import BottomTabBar from "./BottomTabBar.vue";
import PageActions from "./PageActions.vue";
import RecordHeader from "./RecordHeader.vue";
import ResourceHeader from "./ResourceHeader.vue";
import { createPageChrome, installPageChrome, pageChromeKey, usePageChrome } from "./chrome";
import type { PageAction } from "./types";

const view = defineComponent({ render: () => h("div") });

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: view },
      { path: "/customers", name: "list", component: view },
      { path: "/customers/1", name: "record", component: view },
      { path: "/c", name: "catalogue", component: view },
      { path: "/c/3/brands", name: "brands", component: view },
      { path: "/c/3/brands/4/models", name: "models", component: view },
    ],
  });
}

const i18n = createTestI18n("en");
const settle = async () => {
  await nextTick();
  await nextTick();
  await nextTick();
};

let media: ReturnType<typeof mockMedia>;
beforeEach(() => {
  media = mockMedia();
});
afterEach(() => {
  media.restore();
  document.body.innerHTML = "";
  document.body.className = "";
});

describe("createPageChrome", () => {
  it("collects the actions of every owner in registration order, and the last leading, status and title win", () => {
    const chrome = createPageChrome();
    const page = chrome.claim();
    const section = chrome.claim();
    const a: PageAction = { id: "a", label: "A", onClick: () => {} };
    const b: PageAction = { id: "b", label: "B", onClick: () => {} };
    const cancel: PageAction = { id: "cancel", label: "Cancel", onClick: () => {} };

    page.setRegistration({ actions: [a], leading: null, status: "page status", navTitle: null });
    section.setRegistration({ actions: [b], leading: cancel, status: "section status", navTitle: "Edit" });

    expect(chrome.actions.value.map((action) => action.id)).toEqual(["a", "b"]);
    expect(chrome.leading.value).toBe(cancel);
    expect(chrome.status.value).toBe("section status");
    expect(chrome.navTitle.value).toBe("Edit");

    section.clearRegistration();
    expect(chrome.actions.value.map((action) => action.id)).toEqual(["a"]);
    expect(chrome.leading.value).toBeNull();
    expect(chrome.status.value).toBe("page status");
  });

  it("an owner that cleans up after the next one mounted cannot clear its values", () => {
    const chrome = createPageChrome();
    const previous = chrome.claim();
    const current = chrome.claim();
    previous.setTitle("Previous");
    previous.setTitleInView(false);
    current.setTitle("Current");
    previous.clearTitle();

    expect(chrome.title.value).toBe("Current");
    expect(chrome.titleInView.value).toBe(true);

    previous.setBack({ label: "Old", to: "/old" });
    current.setBack({ label: "New", to: "/new" });
    previous.clearBack();
    expect(chrome.back.value).toEqual({ label: "New", to: "/new" });
  });

  it("two chromes share nothing", () => {
    const one = createPageChrome();
    const two = createPageChrome();
    one.claim().setTitle("one");

    expect(two.title.value).toBe("");
  });

  it("remembers at most 30 urls of focus and gives each back once", () => {
    const { focusMemory } = createPageChrome();
    for (let i = 0; i < 35; i++) focusMemory.put(`/list/${i}`, { href: `/r/${i}`, top: i });

    expect(focusMemory.take("/list/0")).toBeUndefined();
    expect(focusMemory.take("/list/34")).toEqual({ href: "/r/34", top: 34 });
    expect(focusMemory.take("/list/34")).toBeUndefined();
  });

  it("claimShell counts mounted shells and releasing twice counts once", () => {
    const chrome = createPageChrome();
    const release = chrome.claimShell();
    chrome.claimShell();
    expect(chrome.hasShell.value).toBe(true);
    release();
    release();
    expect(chrome.hasShell.value).toBe(true);
  });
});

describe("usePageChrome", () => {
  it("explains what is missing when no page chrome was installed", () => {
    const Page = defineComponent({
      setup() {
        usePageChrome({ actions: () => [] });
        return () => h("div");
      },
    });

    expect(() => render(Page)).toThrow(MissingContextError);
    expect(() => render(Page)).toThrow(/vue-core.pageChrome/);
  });

  it("registers for the life of its component and removes itself on unmount", async () => {
    const chrome = createPageChrome();
    const show = ref(true);
    const Section = defineComponent({
      setup() {
        usePageChrome({ actions: () => [{ id: "save", label: "Save", placement: "primary", onClick: () => {} }], status: "Unsaved" });
        return () => h("p", "Section");
      },
    });
    const Host = defineComponent({ setup: () => () => (show.value ? h(Section) : null) });
    render(Host, { global: { provide: { [pageChromeKey as symbol]: chrome } } });

    expect(chrome.actions.value.map((action) => action.id)).toEqual(["save"]);
    expect(chrome.status.value).toBe("Unsaved");

    show.value = false;
    await nextTick();
    expect(chrome.actions.value).toEqual([]);
    expect(chrome.status.value).toBeNull();
  });

  it("follows reactive sources", async () => {
    const chrome = createPageChrome();
    const editing = ref(false);
    const Page = defineComponent({
      setup() {
        usePageChrome({
          actions: () => (editing.value ? [{ id: "save", label: "Save", onClick: () => {} }] : [{ id: "edit", label: "Edit", onClick: () => {} }]),
          leading: () => (editing.value ? { id: "cancel", label: "Cancel", onClick: () => {} } : null),
        });
        return () => h("div");
      },
    });
    render(Page, { global: { provide: { [pageChromeKey as symbol]: chrome } } });
    expect(chrome.actions.value[0]?.id).toBe("edit");

    editing.value = true;
    await nextTick();
    expect(chrome.actions.value[0]?.id).toBe("save");
    expect(chrome.leading.value?.id).toBe("cancel");
  });

  it("installPageChrome gives an app its one chrome", () => {
    const app = createApp({ render: () => h("div") });
    const chrome = installPageChrome(app);
    expect(app.runWithContext(() => (app._context.provides as Record<symbol, unknown>)[pageChromeKey as symbol])).toBe(chrome);
  });
});

describe("AdaptivePageShell", () => {
  async function mountShell(props: Record<string, unknown> = {}, slots: Record<string, unknown> = {}, chrome = createPageChrome(), path = "/customers/1") {
    const router = makeRouter();
    await router.push(path);
    const result = render(AdaptivePageShell, {
      props: { title: "Customer", ...props },
      slots: { default: "<p>Content</p>", ...slots },
      global: { plugins: [i18n, router], stubs: { transition: false }, provide: { [pageChromeKey as symbol]: chrome } },
    });
    return { ...result, chrome, router };
  }

  it("a record page has a toolbar with its back and publishes the back to the nav bar", async () => {
    const { chrome, unmount } = await mountShell({ back: { label: "Customers", to: { name: "list", query: { q: "saved" } } } });

    const back = document.querySelector<HTMLAnchorElement>("[data-page-back]")!;
    expect(back.textContent).toContain("Customers");
    expect(back.getAttribute("href")).toBe("/customers?q=saved");
    expect(chrome.back.value).toEqual({ label: "Customers", to: { name: "list", query: { q: "saved" } } });

    unmount();
    expect(chrome.back.value).toBeNull();
  });

  it("a collection page has no toolbar: its title and actions are in the large-title header", async () => {
    await mountShell({ actions: [{ id: "create", label: "Create", placement: "primary", onClick: () => {} }], count: 1248 });

    expect(document.querySelector("[data-page-back]")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Customer");
    expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
    expect(document.querySelector("[data-resource-count]")!.textContent).toMatch(/1.?248/);
  });

  it("claims the page gutters while mounted", async () => {
    const chrome = createPageChrome();
    const { unmount } = await mountShell({}, {}, chrome);
    expect(chrome.hasShell.value).toBe(true);

    unmount();
    expect(chrome.hasShell.value).toBe(false);
  });

  it("owns the gutters and the content width", async () => {
    const { container } = await mountShell({ width: "content" });
    const content = container.querySelector("[data-page-shell] > div:last-of-type")!;

    expect(content.className).toContain("max-w-content");
    expect(content.className).toContain("pl-[max(var(--app-screen-padding),var(--app-safe-left))]");
    expect(container.innerHTML).not.toContain("<style");
  });

  it("renders the notices, the content and a bar in the bottom dock", async () => {
    await mountShell({}, { notices: "<p>Notice</p>", bottom: "<button>Save</button>" });

    expect(screen.getByText("Notice")).toBeTruthy();
    expect(screen.getByText("Content")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("shows actions registered by a section in the toolbar and clears them with the section", async () => {
    const router = makeRouter();
    await router.push("/customers/1");
    const editing = ref(false);
    const onEdit = vi.fn(() => {
      editing.value = true;
    });
    const Section = defineComponent({
      setup() {
        usePageChrome({
          actions: (): PageAction[] =>
            editing.value
              ? [{ id: "save", label: "Save", placement: "primary", onClick: vi.fn() }]
              : [{ id: "edit", label: "Edit", placement: "primary", prominence: "standard", onClick: onEdit }],
          leading: () => (editing.value ? { id: "cancel", label: "Cancel", onClick: () => (editing.value = false) } : null),
          status: () => (editing.value ? "Unsaved changes" : null),
        });
        return () => h("p", "Section");
      },
    });
    const show = ref(true);
    // No app chrome: the shell keeps its own for what renders inside it.
    const Host = defineComponent({
      setup: () => () => h(AdaptivePageShell, { title: "Customer", back: { label: "Customers", to: "/customers" } }, { default: () => (show.value ? h(Section) : null) }),
    });
    render(Host, { global: { plugins: [i18n, router] } });

    await settle();
    await fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledOnce();
    await settle();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Unsaved changes");

    show.value = false;
    await settle();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("renders a path of two or more ancestors as links, with the parent as the back", async () => {
    const path = [
      { label: "Catalogue", to: { name: "catalogue" } },
      { label: "Passenger cars", to: { name: "brands" } },
      { label: "Renault", to: { name: "models" } },
    ];
    const { chrome } = await mountShell({ title: "Clio", path }, {}, createPageChrome(), "/c");

    const nav = screen.getByRole("navigation", { name: "Breadcrumbs" });
    const items = nav.querySelectorAll<HTMLAnchorElement>("[data-page-path-item]");
    expect([...items].map((item) => item.textContent?.trim())).toEqual(["Catalogue", "Passenger cars"]);
    expect([...items].map((item) => item.getAttribute("href"))).toEqual(["/c", "/c/3/brands"]);
    const back = nav.querySelector<HTMLAnchorElement>("[data-page-back]")!;
    expect(back.textContent?.trim()).toBe("Renault");
    expect(back.getAttribute("href")).toBe("/c/3/brands/4/models");
    // The phone nav bar gets the parent as its back.
    expect(chrome.back.value).toEqual({ label: "Renault", to: { name: "models" } });
  });

  it("keeps the plain back for a path of one level", async () => {
    await mountShell({ path: [{ label: "Customers", to: { name: "list" } }] });

    expect(screen.queryByRole("navigation", { name: "Breadcrumbs" })).toBeNull();
    expect(document.querySelector("[data-page-back]")!.textContent).toContain("Customers");
  });

  it("an explicit null back means none, whatever the path", async () => {
    const { chrome } = await mountShell({ back: null, path: [{ label: "Customers", to: { name: "list" } }] });
    expect(document.querySelector("[data-page-back]")).toBeNull();
    expect(chrome.back.value).toBeNull();
  });

  it("puts the pager in the toolbar on desktop and under the content on a phone", async () => {
    await mountShell({ back: { label: "Customers", to: "/customers" } }, { pager: "<span>3 / 10</span>" });
    const toolbar = document.querySelector("[data-page-back]")!.parentElement!;
    expect(toolbar.textContent).toContain("3 / 10");
    document.body.innerHTML = "";

    media.set({ compact: true });
    await mountShell({ back: { label: "Customers", to: "/customers" } }, { pager: "<span>3 / 10</span>" });
    expect(document.querySelector("[data-page-back]")).toBeNull();
    expect(screen.getByText("3 / 10").parentElement!.className).toContain("justify-center");
  });

  it("restores the focused link and the scroll position when coming back to the same url", async () => {
    const chrome = createPageChrome();
    chrome.focusMemory.put("/customers/1", { href: "/customers/1?row=7", top: 120 });
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const focused = vi.spyOn(HTMLElement.prototype, "focus");
    const router = makeRouter();
    await router.push("/customers/1");
    // A render function, not a template string: a string slot is recompiled on every render, which remounts the link.
    render(AdaptivePageShell, {
      props: { title: "Customers" },
      slots: { default: () => h("a", { href: "/customers/1?row=7" }, "Seven") },
      global: { plugins: [i18n, router], provide: { [pageChromeKey as symbol]: chrome } },
    });

    // (The test renderer re-parents the mounted tree afterwards, which resets the document's focus,
    // so the focus call itself is what is observed.)
    expect(focused.mock.contexts.map((element) => (element as HTMLElement).getAttribute("href"))).toContain("/customers/1?row=7");
    focused.mockRestore();
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 120 }));
    scrollTo.mockRestore();
  });

  it("remembers the followed link when the page goes away, for the next visit", async () => {
    const chrome = createPageChrome();
    vi.spyOn(window, "scrollY", "get").mockReturnValue(340);
    const router = makeRouter();
    await router.push("/customers");
    const { unmount } = render(AdaptivePageShell, {
      props: { title: "Customers" },
      slots: { default: () => h("a", { href: "/customers/1" }, "One") },
      global: { plugins: [i18n, router], provide: { [pageChromeKey as symbol]: chrome } },
    });
    screen.getByRole("link", { name: "One" }).focus();

    unmount();
    expect(chrome.focusMemory.take("/customers")).toEqual({ href: "/customers/1", top: 340 });
  });
});

describe("PageActions", () => {
  const mount = (actions: PageAction[], leading?: PageAction | null) =>
    render(PageActions, { props: { actions, leading }, global: { plugins: [i18n], stubs: { transition: false } } });

  it("renders nothing without actions", () => {
    const { container } = mount([]);
    expect(container.querySelector("[data-page-overflow]")).toBeNull();
    expect(container.firstElementChild).toBeNull();
  });

  it("primary is filled, secondary standard, and a prominence override wins", () => {
    mount([
      { id: "create", label: "Create", placement: "primary", onClick: vi.fn() },
      { id: "export", label: "Export", onClick: vi.fn() },
      { id: "edit", label: "Edit", placement: "primary", prominence: "standard", onClick: vi.fn() },
      { id: "skip", label: "Skip", prominence: "plain", onClick: vi.fn() },
    ]);

    expect(screen.getByRole("button", { name: "Create" }).className).toContain("bg-tint");
    expect(screen.getByRole("button", { name: "Export" }).className).toContain("bg-fill");
    expect(screen.getByRole("button", { name: "Edit" }).className).toContain("bg-fill");
    expect(screen.getByRole("button", { name: "Skip" }).className).toContain("bg-transparent");
  });

  it("overflow and critical actions go in the menu, critical last and red, and running one restores focus first", async () => {
    const more = vi.fn(() => document.activeElement?.getAttribute("aria-label"));
    mount([
      { id: "delete", label: "Delete", tone: "critical", onClick: vi.fn() },
      { id: "more", label: "More stuff", placement: "overflow", onClick: more },
    ]);
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();

    const trigger = screen.getByRole("button", { name: "More actions" });
    await fireEvent.click(trigger);
    await settle();
    const items = screen.getAllByRole("menuitem");
    expect(items.map((item) => item.textContent?.trim())).toEqual(["More stuff", "Delete"]);
    expect(items[1]!.className).toContain("text-content-destructive");

    await fireEvent.click(items[0]!);
    await vi.waitFor(() => expect(more).toHaveBeenCalledOnce());
    expect(more).toHaveReturnedWith("More actions");
  });

  it("disabled and processing actions cannot run, inline or in the menu", async () => {
    const click = vi.fn();
    mount([
      { id: "disabled", label: "Disabled", placement: "primary", disabled: true, onClick: click },
      { id: "processing", label: "Processing", placement: "overflow", processing: true, onClick: click },
    ]);

    await fireEvent.click(screen.getByRole("button", { name: "Disabled" }));
    await fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    await settle();
    const item = screen.getByRole("menuitem", { name: "Processing" }) as HTMLButtonElement;
    expect(item.disabled).toBe(true);
    expect(item.getAttribute("aria-busy")).toBe("true");
    await fireEvent.click(item);
    expect(click).not.toHaveBeenCalled();
  });

  it("the leading action comes first, as plain text", () => {
    mount([{ id: "save", label: "Save", placement: "primary", onClick: vi.fn() }], { id: "cancel", label: "Cancel", onClick: vi.fn() });
    const buttons = screen.getAllByRole("button");

    expect(buttons.map((button) => button.textContent?.trim())).toEqual(["Cancel", "Save"]);
    expect(buttons[0]!.className).toContain("bg-transparent");
  });

  it("removing the actions removes the menu trigger", async () => {
    const { rerender } = mount([{ id: "more", label: "More", placement: "overflow", onClick: vi.fn() }]);
    expect(screen.getByRole("button", { name: "More actions" })).toBeTruthy();

    await rerender({ actions: [] });
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
  });

  it("a shortcut runs the action", async () => {
    const onClick = vi.fn();
    mount([{ id: "save", label: "Save", placement: "primary", keyboardShortcut: { key: "s", ctrlKey: true }, onClick }]);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("ResourceHeader", () => {
  const mount = (props: Record<string, unknown> = {}) => render(ResourceHeader, { props: { title: "Customers", ...props }, global: { plugins: [i18n] } });

  it("is the page h1 with a count formatted for the locale and no action area without actions", () => {
    const { container } = mount({ count: 1248 });

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Customers");
    expect(container.querySelector("[data-resource-count]")!.textContent).toMatch(/1.?248/);
    expect(container.querySelector("[data-page-overflow]")).toBeNull();
  });

  it("shows no count for null and a zero count as 0", () => {
    const empty = mount({ count: null });
    expect(empty.container.querySelector("[data-resource-count]")).toBeNull();
    empty.unmount();
    expect(mount({ count: 0 }).container.querySelector("[data-resource-count]")!.textContent?.trim()).toBe("0");
  });

  it("leaves the actions to the phone nav bar unless asked to render them inline", () => {
    media.set({ compact: true });
    const actions: PageAction[] = [{ id: "create", label: "Create", placement: "primary", onClick: vi.fn() }];

    const phone = mount({ actions });
    expect(screen.queryByRole("button", { name: "Create" })).toBeNull();
    phone.unmount();
    mount({ actions, inlineActions: true });
    expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
  });

  it("shows the status and the leading action beside the actions", () => {
    mount({ status: "Unsaved changes", leading: { id: "cancel", label: "Cancel", onClick: vi.fn() } });
    expect(screen.getByRole("status").textContent).toContain("Unsaved changes");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("publishes its title to the app's chrome until unmounted", () => {
    const chrome = createPageChrome();
    const { unmount } = render(ResourceHeader, { props: { title: "Customers" }, global: { plugins: [i18n], provide: { [pageChromeKey as symbol]: chrome } } });
    expect(chrome.title.value).toBe("Customers");

    unmount();
    expect(chrome.title.value).toBe("");
  });

  it("uses the brand tile role for its icon, no palette step", () => {
    const { container } = mount({ icon: "save" });
    const tile = container.querySelector("[aria-hidden='true']")!;

    expect(tile.className).toContain("bg-tile-brand");
    expect(container.innerHTML).not.toMatch(/(?:bg|text)-(?:primary|gray)-\d/);
  });
});

describe("RecordHeader", () => {
  it("is the page h1 and publishes its title until unmounted", () => {
    const chrome = createPageChrome();
    const { unmount } = render(RecordHeader, {
      props: { title: "Ivan Horvat", subtitle: "Private person · Sarajevo" },
      slots: { leading: "<span data-avatar>IH</span>", meta: "<span>Sarajevo</span>" },
      global: { provide: { [pageChromeKey as symbol]: chrome } },
    });

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Ivan Horvat");
    expect(document.querySelector("[data-avatar]")).not.toBeNull();
    expect(chrome.title.value).toBe("Ivan Horvat");

    unmount();
    expect(chrome.title.value).toBe("");
  });

  it("renders quick actions as links or buttons, and nothing without them", async () => {
    const onClick = vi.fn();
    const { container, rerender } = render(RecordHeader, {
      props: {
        title: "Ivan Horvat",
        quickActions: [
          { id: "call", label: "Call", icon: "save", href: "tel:061123222" },
          { id: "note", label: "Note", icon: "save", onClick },
        ],
      },
    });

    expect(screen.getByRole("link", { name: "Call" }).getAttribute("href")).toBe("tel:061123222");
    await fireEvent.click(screen.getByRole("button", { name: "Note" }));
    expect(onClick).toHaveBeenCalledOnce();

    await rerender({ quickActions: [] });
    expect(container.querySelector("nav")).toBeNull();
  });
});

describe("BottomDock", () => {
  it("renders pinned bars in place without a dock, and in the dock with one", async () => {
    const Bar = defineComponent({
      components: { BottomDockPortal },
      template: `<BottomDockPortal><p id="bar">Pinned</p></BottomDockPortal>`,
    });
    const alone = render(Bar);
    expect(alone.container.querySelector("#bar")).not.toBeNull();
    alone.unmount();

    const App = defineComponent({ components: { BottomDock, Bar }, template: `<div id="page"><Bar /></div><BottomDock class="md:left-64" />` });
    const { container } = render(App, { global: { provide: { [bottomDockKey as symbol]: ref(null) } } });
    await nextTick();
    await nextTick();

    const dock = container.querySelector("[data-bottom-dock]")!;
    expect(dock.querySelector("#bar")).not.toBeNull();
    expect(dock.className).toContain("md:left-64");
    expect(container.querySelector("#page #bar")).toBeNull();
  });

  it("publishes its height for pages and toasts, and forgets it when unmounted", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 57.4 } as DOMRect);
    const { unmount } = render(BottomDock, { global: { provide: { [bottomDockKey as symbol]: ref(null) } } });
    expect(document.documentElement.style.getPropertyValue("--bottom-dock-h")).toBe("57px");

    unmount();
    expect(document.documentElement.style.getPropertyValue("--bottom-dock-h")).toBe("");
    vi.restoreAllMocks();
  });
});

describe("BottomTabBar", () => {
  const items = [
    { value: "overview", label: "Overview", icon: "save" as const, active: true },
    { value: "notes", label: "Notes", active: false, badge: 3 },
    { value: "files", label: "Files", active: false, warning: "Documents missing" },
  ];

  it("is a tab bar, one selected tab in the tab order, and emits the value a tap selects", async () => {
    const onSelect = vi.fn();
    render(BottomTabBar, { props: { items, label: "Sections", onSelect } });

    const tabs = screen.getAllByRole("tab");
    expect(screen.getByRole("tablist", { name: "Sections" })).toBeTruthy();
    expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    expect(tabs.map((tab) => tab.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);

    await fireEvent.click(tabs[1]!);
    expect(onSelect).toHaveBeenCalledWith("notes");
  });

  it("names a warning for assistive tech and shows a badge count", () => {
    render(BottomTabBar, { props: { items } });
    expect(screen.getByRole("tab", { name: /Documents missing/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Notes/ }).textContent).toContain("3");
  });

  it("uses the semantic roles only", () => {
    const { container } = render(BottomTabBar, { props: { items } });
    expect(container.innerHTML).not.toMatch(/(?:bg|text|border|ring)-(?:gray|white|primary|red)-?\d*/);
  });
});
