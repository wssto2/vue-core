import { fireEvent, screen, within } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, onMounted, onUnmounted } from "vue";
import { defineFeature, type ShellContribution } from "../app";
import { BottomTabBar, usePageChrome, usePageChromeContext } from "../page";
import { AppRouterView } from "../router";
import { mockMedia } from "../testing/media";
import AccountMenuItem from "./AccountMenuItem.vue";
import { backofficeShell } from "./backofficeShell";
import HeaderAction from "./HeaderAction.vue";
import ShellSidebar from "./ShellSidebar.vue";
import ShellTopBar from "./ShellTopBar.vue";
import { useShellIdentity } from "./identity";
import { createNavigationProgress } from "./progress";
import { settle, signedIn, startShell, stopShells, label, page } from "./testing";

const user = { id: 1, name: "Ana Anić", email: "ana@example.com" };
const session = signedIn(1, [], {
  user,
  navigation: [
    { i18n: "nav.sales", children: [{ i18n: "nav.dashboard", route: "home" }, { i18n: "nav.other", route: "other" }] },
    { i18n: "nav.reports", children: [{ i18n: "nav.reports", route: "reports" }] }, // no feature is installed for it
  ],
});
const messages = { en: { nav: { sales: "Sales", dashboard: "Dashboard", other: "Other", reports: "Reports" } } };
const extra = { i18n: { missingWarn: false, messages } };

const navigation = defineFeature({
  id: "navigation",
  navigation: [{ destination: "home", to: { name: "home" } }, { destination: "other", to: { name: "other" } }],
});

/** Counts how many instances of a contribution are mounted at once (a contribution must never be mounted twice). */
function counted(text: string, tally: { now: number; peak: number; mounts: number }) {
  return defineComponent({
    setup() {
      onMounted(() => {
        tally.now++;
        tally.mounts++;
        tally.peak = Math.max(tally.peak, tally.now);
      });
      onUnmounted(() => tally.now--);
      return () => h(HeaderAction, { label: text, icon: "search" });
    },
  });
}

const contribution = (id: string, slot: ShellContribution["slot"], component: ShellContribution["component"], scope: ShellContribution["scope"] = "authenticated", order = 0): ShellContribution => ({ id, slot, component, scope, order });

let media: ReturnType<typeof mockMedia> | null = null;
afterEach(() => {
  media?.restore();
  media = null;
});

const sidebar = () => document.querySelector<HTMLElement>("[data-shell-sidebar]");
const topBar = () => document.querySelector<HTMLElement>("[data-shell-top-bar]");

afterEach(stopShells);

describe("BackofficeShell on a wide screen", () => {
  it("shows the sidebar with the bound destinations of the server's menu, the current one marked, around the page", async () => {
    await startShell(backofficeShell(), { features: [navigation], session, extra });

    const rail = within(sidebar()!);
    const nav = rail.getByRole("navigation", { name: "Menu" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent?.trim())).toEqual(["Dashboard", "Other"]); // "Reports" has no binding: no link that goes nowhere
    expect(within(nav).getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByText("Sales")).toBeTruthy();
    expect(rail.getByRole("button", { name: /Ana Anić/ })).toBeTruthy();
    expect(screen.getByRole("main").textContent).toContain("home page");
    expect(topBar()).toBeNull(); // the sidebar carries the brand
  });

  it("follows the route: navigating marks the other destination", async () => {
    const { application } = await startShell(backofficeShell(), { features: [navigation], session, extra });
    await application.router.push({ name: "other" });
    await settle();

    const nav = within(sidebar()!).getByRole("navigation");
    expect(within(nav).getByRole("link", { name: "Other" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBeNull();
  });

  it("names the application where there is no logo, and takes the application's own logo", async () => {
    const logo = defineComponent({ props: { tone: { type: String, default: "" } }, render() { return h("svg", { "data-logo": this.tone }); } });
    await startShell(backofficeShell({ brand: logo }), { features: [navigation], session, extra });
    expect(sidebar()!.querySelector("[data-logo]")!.getAttribute("data-logo")).toBe("light"); // drawn on the dark rail
  });

  it("puts the sidebar's header actions in order, the account entries in the menu, and the footer above the account block", async () => {
    const first = { now: 0, peak: 0, mounts: 0 };
    const second = { now: 0, peak: 0, mounts: 0 };
    const profile = defineComponent({ render: () => h(AccountMenuItem, { label: "My profile", to: { name: "other" } }) });
    const features = [
      navigation,
      defineFeature({
        id: "extras",
        contributions: [
          contribution("second", "headerActions", counted("Second action", second), "authenticated", 2),
          contribution("first", "headerActions", counted("First action", first), "authenticated", 1),
          contribution("profile", "accountMenu", profile),
        ],
      }),
    ];
    await startShell(backofficeShell({ footer: label("support@example.com", "p") }), { features, session, extra });

    const actions = within(sidebar()!).getAllByRole("button").filter((button) => button.hasAttribute("data-header-action"));
    expect(actions.map((button) => button.getAttribute("aria-label"))).toEqual(["First action", "Second action"]);
    expect(within(sidebar()!).getByText("support@example.com")).toBeTruthy();

    await fireEvent.click(within(sidebar()!).getByRole("button", { name: /Ana Anić/ }));
    await settle();
    expect(screen.getByRole("link", { name: "My profile" })).toBeTruthy();
    expect([first.peak, second.peak]).toEqual([1, 1]);
  });

  it("shows the no-access state in the page area, with the sidebar still there", async () => {
    const { application } = await startShell(backofficeShell(), { features: [navigation], session, extra, location: "/admin" });

    expect(screen.getByRole("main").textContent).toContain("No access");
    expect(sidebar()).toBeTruthy();
    expect(application.router.currentRoute.value.fullPath).toBe("/admin");
  });

  it("the page padding is the shell's until a page shell owns its gutters", async () => {
    const { AdaptivePageShell } = await import("../page");
    const owning = defineComponent({ render: () => h(AdaptivePageShell, { title: "Leads" }, () => "leads") });
    const own = defineFeature({ id: "own", routes: [{ name: "owning", path: "/owning", component: owning }] });
    const { application } = await startShell(backofficeShell(), { features: [own], session, extra });

    expect(screen.getByRole("main").className).toContain("p-4");
    await application.router.push({ name: "owning" });
    await settle();
    expect(screen.getByRole("main").className).not.toContain("p-4");
  });

  it("mounts the toasts outside the application's subtree, and the host contributions once", async () => {
    const tally = { now: 0, peak: 0, mounts: 0 };
    const host = defineComponent({ setup() { onMounted(() => tally.mounts++); return () => h("span", { "data-host": "" }); } });
    const { target } = await startShell(backofficeShell(), { features: [defineFeature({ id: "hosts", contributions: [contribution("palette", "host", host)] })], session, extra });

    const toaster = document.body.querySelector("[data-sonner-toaster]");
    expect(toaster).toBeTruthy();
    expect(target.contains(toaster)).toBe(false);
    expect(toaster!.closest("[data-dialog-inert-skip]")).toBeTruthy();
    expect(tally.mounts).toBe(1);
  });

  it("takes a page's tab bar into the dock, which the shell keeps beside the sidebar", async () => {
    const tabs = defineComponent({ render: () => h(BottomTabBar, { label: "Sections", items: [{ value: "a", label: "General", active: true }, { value: "b", label: "Notes", active: false }] }) });
    await startShell(backofficeShell(), { features: [defineFeature({ id: "tabs", routes: [{ name: "tabs", path: "/tabs", component: tabs }] })], session, extra, location: "/tabs" });

    expect(within(document.querySelector<HTMLElement>("[data-bottom-dock]")!).getByRole("navigation", { name: "Sections" })).toBeTruthy();
  });

  it("renders the bottom dock beside the sidebar (from md up)", async () => {
    await startShell(backofficeShell(), { session, extra });
    expect(document.querySelector("[data-bottom-dock]")!.className).toContain("md:left-64");
  });
});

describe("BackofficeShell signed out", () => {
  const always = defineFeature({
    id: "guest",
    contributions: [
      contribution("help", "host", label("Help host", "p"), "always"),
      contribution("private", "host", label("Private host", "p"), "authenticated"),
    ],
  });

  it("is the brand bar and the page, with no sidebar, account menu or authenticated contribution", async () => {
    await startShell(backofficeShell(), { features: [always], session: null, location: "/login", extra });

    expect(sidebar()).toBeNull();
    expect(within(topBar()!).getByText("Test app")).toBeTruthy();
    expect(screen.getByRole("main").textContent).toBe("login page");
    expect(screen.queryByRole("button", { name: /Ana/ })).toBeNull();
    expect(screen.getByText("Help host")).toBeTruthy();
    expect(screen.queryByText("Private host")).toBeNull();
  });

  it("gives the authenticated contributions back when someone signs in, and takes them away on sign-out", async () => {
    const { platform } = await startShell(backofficeShell(), { features: [navigation, always], session, extra });
    expect(screen.getByText("Private host")).toBeTruthy();

    await platform.session.signOut();
    await settle();

    expect(screen.queryByText("Private host")).toBeNull();
    expect(screen.getByText("Help host")).toBeTruthy();
    expect(sidebar()).toBeNull();
    expect(topBar()).toBeTruthy();
  });

  it("shows the authenticated contributions only once someone has signed in", async () => {
    const { platform } = await startShell(backofficeShell(), { features: [always], session: null, location: "/login", extra });
    expect(screen.queryByText("Private host")).toBeNull();

    platform.session.establish(session as never);
    await settle();

    expect(screen.getByText("Private host")).toBeTruthy();
  });

  it("the end of the top bar takes extra content", async () => {
    await startShell(backofficeShell({ topBarEnd: label("Need help?", "a") }), { session: null, location: "/login", extra });
    expect(within(topBar()!).getByText("Need help?")).toBeTruthy();
  });
});

describe("BackofficeShell on a phone", () => {
  beforeEach(() => {
    media = mockMedia({ compact: true });
  });

  it("has no sidebar: the top bar's menu button and the drawer carry the navigation", async () => {
    await startShell(backofficeShell(), { features: [navigation], session, extra });

    expect(sidebar()).toBeNull();
    expect(within(topBar()!).getByRole("button", { name: "Menu" })).toBeTruthy();
    const drawer = document.querySelector("[data-shell-drawer]")!;
    const menu = within(within(drawer as HTMLElement).getByRole("navigation", { name: "Menu" }));
    expect(menu.getAllByRole("link").map((link) => link.textContent?.trim())).toEqual(["Dashboard", "Other"]);
    expect(within(drawer as HTMLElement).getByText("Ana Anić")).toBeTruthy();
    expect(document.querySelector("[data-bottom-dock]")!.className).toContain("md:left-64"); // a media-query class: inert on a phone
  });

  it("mounts a header action once in the bar, beside the menu button, and never twice when the screen changes", async () => {
    const tally = { now: 0, peak: 0, mounts: 0 };
    const features = [navigation, defineFeature({ id: "actions", contributions: [contribution("search", "headerActions", counted("Search", tally))] })];
    await startShell(backofficeShell(), { features, session, extra });

    expect(within(topBar()!).getByRole("button", { name: "Search" })).toBeTruthy();
    expect(tally.now).toBe(1);

    media!.set({ compact: false });
    await settle();
    expect(within(sidebar()!).getByRole("button", { name: "Search" })).toBeTruthy();
    expect(topBar()).toBeNull();

    expect(tally.peak).toBe(1);
    expect(tally.now).toBe(1);
  });

  it("reads the page chrome: back with the page's parent, the title once its large title is away, the primary actions and the rest in a More menu", async () => {
    const save = vi.fn();
    const pageWithChrome = defineComponent({
      setup() {
        const owner = usePageChromeContext().claim();
        owner.setTitle("Lead 7");
        owner.setTitleInView(false);
        owner.setBack({ label: "Leads", to: { name: "other" } });
        usePageChrome({
          actions: [
            { id: "save", label: "Save changes", shortLabel: "Save", placement: "primary", onClick: save },
            { id: "archive", label: "Archive", onClick: () => undefined },
          ],
        });
        return () => h("p", "lead");
      },
    });
    const feature = defineFeature({ id: "lead", routes: [{ name: "lead", path: "/lead", component: pageWithChrome }] });
    const { application } = await startShell(backofficeShell(), { features: [navigation, feature], session, extra, location: "/lead" });

    const bar = within(topBar()!);
    expect(bar.queryByRole("button", { name: "Menu" })).toBeNull(); // a record page has a back, not the menu
    expect(bar.getByRole("button", { name: "Leads" })).toBeTruthy();
    expect(topBar()!.querySelector("[data-shell-bar-title]")!.textContent).toBe("Lead 7");
    await fireEvent.click(bar.getByRole("button", { name: "Save changes" }));
    expect(save).toHaveBeenCalledTimes(1);
    expect(bar.getByRole("button", { name: "More actions" })).toBeTruthy();

    await fireEvent.click(bar.getByRole("button", { name: "Leads" }));
    await settle();
    expect(application.router.currentRoute.value.name).toBe("other");
  });

  it("a leading action (Cancel while editing) replaces the back", async () => {
    const cancel = vi.fn();
    const editing = defineComponent({
      setup() {
        usePageChromeContext().claim().setBack({ label: "Leads", to: { name: "other" } });
        usePageChrome({ leading: { id: "cancel", label: "Cancel", onClick: cancel }, navTitle: "Edit lead" });
        return () => h("p", "editing");
      },
    });
    await startShell(backofficeShell(), { features: [defineFeature({ id: "edit", routes: [{ name: "edit", path: "/edit", component: editing }] })], session, extra, location: "/edit" });

    const bar = within(topBar()!);
    expect(bar.queryByRole("button", { name: "Leads" })).toBeNull();
    await fireEvent.click(bar.getByRole("button", { name: "Cancel" }));
    expect(cancel).toHaveBeenCalled();
    expect(topBar()!.querySelector("[data-shell-bar-title]")!.textContent).toBe("Edit lead");
  });

  it("opens the account sheet from the drawer's account row only once the drawer has closed", async () => {
    const { backend } = await startShell(backofficeShell(), { features: [navigation], session, extra });
    await fireEvent.click(within(topBar()!).getByRole("button", { name: "Menu" }));
    await settle();

    await fireEvent.click(document.querySelector("[data-shell-drawer-account]")!);
    expect(screen.queryAllByRole("dialog").filter((dialog) => dialog.getAttribute("aria-label") !== "Menu")).toHaveLength(0); // not over the drawer
    await new Promise((resolve) => setTimeout(resolve, 80));
    await settle();

    const sheet = screen.getAllByRole("dialog").find((dialog) => dialog.getAttribute("aria-label") !== "Menu")!;
    expect(within(sheet).getByText("Ana Anić")).toBeTruthy();
    await fireEvent.click(within(sheet).getByRole("button", { name: "Sign out" }));
    await settle();
    expect(backend.signOuts).toBe(1);
  });
});

describe("the startup failure", () => {
  it("replaces the shell with the failure and retry brings the shell back", async () => {
    const { application, backend } = await startShell(backofficeShell(), { features: [navigation], session, extra, prepare: (backend) => (backend.failing = true) });

    expect(screen.getByText("The application could not start")).toBeTruthy();
    expect(sidebar()).toBeNull();
    expect(application.state.value).toMatchObject({ status: "failed", kind: "session" });

    backend.failing = false;
    await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await settle();
    expect(sidebar()).toBeTruthy();
  });
});

describe("the page-load indicator", () => {
  it("shows nothing for a quick wait, then a bar until the navigation ends; the router gets it from the shell", async () => {
    let release!: () => void;
    const slow = defineFeature({
      id: "slow",
      routes: [{ name: "slow", path: "/slow", component: page("slow page"), beforeEnter: () => new Promise<void>((resolve) => (release = resolve)) }],
    });
    const { application } = await startShell(backofficeShell(), { features: [slow], session, extra });
    expect(document.querySelector("[data-shell-progress]")).toBeNull();

    const navigating = application.router.push({ name: "slow" });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(document.querySelector("[data-shell-progress]")).toBeNull(); // not before 0.3 s
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(document.querySelector("[data-shell-progress]")!.getAttribute("role")).toBe("progressbar");

    release();
    await navigating;
    await settle();
    expect(document.querySelector("[data-shell-progress]")).toBeNull();
  });

  it("a navigation that ends before the delay never shows it", () => {
    vi.useFakeTimers();
    const progress = createNavigationProgress(300);
    progress.start();
    vi.advanceTimersByTime(299);
    progress.done();
    vi.advanceTimersByTime(1000);
    expect(progress.visible.value).toBe(false);

    progress.start();
    vi.advanceTimersByTime(300);
    expect(progress.visible.value).toBe(true);
    progress.done();
    expect(progress.visible.value).toBe(false);
    vi.useRealTimers();
  });
});

describe("a shell of the application's own, from the same pieces", () => {
  it("composes ShellSidebar and ShellTopBar and keeps the outlets, the menu and the account", async () => {
    const tally = { now: 0, peak: 0, mounts: 0 };
    const custom = {
      slots: ["headerActions", "accountMenu"] as const,
      component: defineComponent({
        setup() {
          const identity = useShellIdentity();
          return () =>
            h("div", { class: "flex" }, [
              identity.value && h(ShellSidebar, { identity: identity.value }),
              h("div", [h(ShellTopBar), h("main", [h(AppRouterView)])]),
            ]);
        },
      }),
    };
    const features = [navigation, defineFeature({ id: "actions", contributions: [contribution("bell", "headerActions", counted("Bell", tally))] })];
    await startShell(custom, { features, session, extra });

    const rail = within(sidebar()!);
    expect(rail.getByRole("link", { name: "Dashboard" })).toBeTruthy();
    expect(rail.getByRole("link", { name: "Other" })).toBeTruthy();
    expect(rail.getByRole("button", { name: "Bell" })).toBeTruthy();
    expect(rail.getByRole("button", { name: /Ana Anić/ })).toBeTruthy();
    expect(tally.peak).toBe(1);
  });
});

describe("dispose", () => {
  it("removes every listener the shell added to the window and the document", async () => {
    const added: [EventTarget, string, unknown][] = [];
    const removed: [EventTarget, string, unknown][] = [];
    const track = (target: EventTarget) => {
      const add = target.addEventListener.bind(target);
      const remove = target.removeEventListener.bind(target);
      vi.spyOn(target, "addEventListener").mockImplementation((type, listener, options) => {
        added.push([target, type, listener]);
        add(type, listener, options);
      });
      vi.spyOn(target, "removeEventListener").mockImplementation((type, listener, options) => {
        removed.push([target, type, listener]);
        remove(type, listener, options);
      });
    };
    track(window);
    track(document);
    const { application } = await startShell(backofficeShell(), { features: [navigation], session, extra });

    application.dispose();
    await settle();

    const leftover = added.filter(([target, type, listener]) => !removed.some(([t, ty, l]) => t === target && ty === type && l === listener));
    expect(leftover.map(([, type]) => type)).toEqual([]);
    vi.restoreAllMocks();
  });
});
