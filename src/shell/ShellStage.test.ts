import { fireEvent, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import type { RouteLocationRaw } from "vue-router";
import { defineFeature } from "../app";
import { AppRouterView } from "../router";
import { mockMedia } from "../testing/media";
import NavigationDrawer from "./NavigationDrawer.vue";
import NavigationMenuButton from "./NavigationMenuButton.vue";
import ShellStage from "./ShellStage.vue";
import { useShellIdentity } from "./identity";
import { settle, signedIn, startShell, stopShells } from "./testing";

const session = signedIn(1, [], { navigation: [{ i18n: "nav.sales", children: [{ i18n: "nav.home", route: "home" }, { i18n: "nav.other", route: "other" }] }] });
const navigation = defineFeature({
  id: "navigation",
  navigation: [{ destination: "home", to: { name: "home" } }, { destination: "other", to: { name: "other" } }],
});
const extra = { i18n: { missingWarn: false, messages: { en: { nav: { sales: "Sales", home: "Dashboard", other: "Other" } } } } };

/** A shell of only what the stage needs: the drawer's content, a menu button, the page. */
const stageShell = {
  slots: [] as const,
  component: defineComponent({
    setup() {
      const identity = useShellIdentity();
      return () =>
        h(
          ShellStage,
          { enabled: identity.value !== null },
          {
            drawer: ({ select }: { select: (to: RouteLocationRaw) => void }) => h(NavigationDrawer, { identity: identity.value!, onSelect: select }),
            default: () => [h(NavigationMenuButton), h("main", [h(AppRouterView)]), h("button", "in page")],
          },
        );
    },
  }),
};

const drawer = () => document.querySelector<HTMLElement>("[data-shell-drawer]")!;
const stage = () => document.querySelector<HTMLElement>("[data-shell-stage]")!;
const menuButton = () => screen.getByRole("button", { name: "Menu", expanded: undefined });
// The drawer has closed once the page behind it is interactive and in place again; polled, not timed,
// so a busy machine does not fail the test.
const afterClose = () =>
  vi.waitFor(
    () => {
      if (stage().hasAttribute("inert") || stage().style.transform !== "") throw new Error("the drawer is still closing");
    },
    { timeout: 2000, interval: 10 },
  );

let media: ReturnType<typeof mockMedia>;
const widthOf = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
beforeEach(() => {
  media = mockMedia({ compact: true });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 320 });
});
afterEach(() => {
  media.restore();
  if (widthOf) Object.defineProperty(HTMLElement.prototype, "offsetWidth", widthOf);
  else Reflect.deleteProperty(HTMLElement.prototype, "offsetWidth");
});

const start = (location = "/") => startShell(stageShell, { features: [navigation], session, location, extra });

afterEach(stopShells);

describe("the phone navigation drawer", () => {
  it("is closed and out of reach until asked: hidden, the page not inert, the button collapsed", async () => {
    await start();

    expect(drawer().className).toContain("invisible");
    expect(stage().hasAttribute("inert")).toBe(false);
    const button = menuButton();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-controls")).toBe(drawer().id);
  });

  it("opens from the menu button: the page is pushed aside and inert, the drawer is a modal dialog with focus on the current destination", async () => {
    await start();
    await fireEvent.click(menuButton());
    await settle();

    expect(menuButton().getAttribute("aria-expanded")).toBe("true");
    const panel = screen.getByRole("dialog", { name: "Menu" });
    expect(panel.getAttribute("aria-modal")).toBe("true");
    expect(panel.className).toContain("visible");
    expect(stage().hasAttribute("inert")).toBe(true);
    expect(stage().style.position).toBe("fixed");
    expect(stage().style.transform).toBe("translate3d(320px, 0, 0)");
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Dashboard" })); // aria-current="page"
  });

  it("Escape closes it, the page is back in place and the focus returns to the menu button", async () => {
    await start();
    const button = menuButton();
    button.focus();
    await fireEvent.click(button);
    await settle();

    await fireEvent.keyDown(document, { key: "Escape" });
    await afterClose();

    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(stage().hasAttribute("inert")).toBe(false);
    expect(stage().style.position).toBe("");
    expect(stage().style.transform).toBe("");
    expect(drawer().className).toContain("invisible");
    expect(document.activeElement).toBe(button);
  });

  it("keeps Tab inside the drawer", async () => {
    await start();
    await fireEvent.click(menuButton());
    await settle();

    const account = drawer().querySelector<HTMLElement>("[data-shell-drawer-account]")!;
    account.focus();
    await fireEvent.keyDown(account, { key: "Tab" });
    expect(document.activeElement).toBe(drawer().querySelector("[data-shell-brand]")); // wrapped to the first control

    const first = drawer().querySelector<HTMLElement>("[data-shell-brand]")!;
    first.focus();
    await fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(account);
  });

  it("a chosen destination is opened, then the drawer closes", async () => {
    const { application } = await start();
    await fireEvent.click(menuButton());
    await settle();

    await fireEvent.click(screen.getByRole("link", { name: "Other" }));
    await afterClose();

    expect(application.router.currentRoute.value.name).toBe("other");
    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
    expect(stage().style.position).toBe("");
  });

  it("the current destination closes it too, although the route does not change", async () => {
    const { application } = await start();
    await fireEvent.click(menuButton());
    await settle();

    await fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));
    await afterClose();

    expect(application.router.currentRoute.value.name).toBe("home");
    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
  });

  it("any navigation closes it (a link elsewhere, the browser's back)", async () => {
    const { application } = await start();
    await fireEvent.click(menuButton());
    await settle();

    await application.router.push({ name: "other" });
    await afterClose();

    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
    expect(stage().hasAttribute("inert")).toBe(false);
  });

  it("a tap on the pushed page closes it", async () => {
    await start();
    await fireEvent.click(menuButton());
    await settle();

    await fireEvent.click(document.querySelector("[data-shell-stage-cover]")!);
    await afterClose();

    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
  });

  it("under reduced motion the page does not slide and the drawer fades instead", async () => {
    media.set({ reducedMotion: true });
    await start();
    await fireEvent.click(menuButton());
    await settle();

    expect(stage().style.transition).toBe("none");
    expect(drawer().style.opacity).toBe("1");
    expect(drawer().style.transition).toContain("opacity");
  });

  it("goes at once when the screen grows past the phone width", async () => {
    await start();
    await fireEvent.click(menuButton());
    await settle();

    media.set({ compact: false });
    await settle();

    expect(document.querySelector("[data-shell-drawer]")).toBeNull();
    expect(stage().hasAttribute("inert")).toBe(false);
    expect(stage().style.position).toBe("");
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull(); // no drawer, no menu button
  });

  it("has no drawer for nobody signed in", async () => {
    await startShell(stageShell, { features: [navigation], session: null, location: "/login", extra });
    expect(document.querySelector("[data-shell-drawer]")).toBeNull();
  });

  it("opens from the left edge in the installed app, and only there", async () => {
    media.set({ standalone: true });
    await start();
    const touch = (type: string, x: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "touches", { value: type === "touchend" ? [] : [{ clientX: x, clientY: 100 }] });
      window.dispatchEvent(event);
    };

    touch("touchstart", 4);
    touch("touchmove", 60);
    touch("touchmove", 240);
    touch("touchend", 240);
    await settle();

    expect(menuButton().getAttribute("aria-expanded")).toBe("true");
    expect(stage().style.transform).toBe("translate3d(320px, 0, 0)");
  });

  it("leaves no listener behind when the application is disposed", async () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { application } = await start();
    const added = add.mock.calls.filter(([type]) => String(type).startsWith("touch")).length;
    expect(added).toBe(4);

    application.dispose();

    expect(remove.mock.calls.filter(([type]) => String(type).startsWith("touch")).length).toBe(added);
    add.mockRestore();
    remove.mockRestore();
  });
});
