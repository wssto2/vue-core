import { fireEvent, screen, within } from "@testing-library/vue";
import { describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, ref } from "vue";
import { AppRouterView } from "../router";
import { defineFeature, ShellOutlet } from "../app";
import { toast } from "../overlay";
import AccountMenu from "./AccountMenu.vue";
import AccountMenuItem from "./AccountMenuItem.vue";
import AccountSheet from "./AccountSheet.vue";
import HeaderAction from "./HeaderAction.vue";
import { useShellIdentity } from "./identity";
import { settle, signedIn, startShell } from "./testing";

const user = { id: 1, name: "Ana Anić", email: "ana@example.com" };
const session = signedIn(1, [], { user });

const dark = ref(false);
const profileRow = defineComponent({ render: () => h(AccountMenuItem, { label: "My profile", to: { name: "other" } }) });
const darkRow = defineComponent({ render: () => h(AccountMenuItem, { label: "Dark mode", checked: dark.value, onClick: () => (dark.value = !dark.value) }) });
const menuFeature = defineFeature({
  id: "menu",
  contributions: [
    { id: "profile", slot: "accountMenu", component: profileRow, scope: "authenticated", order: 1 },
    { id: "dark", slot: "accountMenu", component: darkRow, scope: "authenticated", order: 2 },
  ],
});

/** A shell with only the account menu beside the page. */
const shell = {
  slots: ["accountMenu"] as const,
  component: defineComponent({
    setup() {
      const identity = useShellIdentity();
      return () => h("div", [identity.value && h(AccountMenu, { identity: identity.value }), h("main", [h(AppRouterView)])]);
    },
  }),
};

const open = async () => {
  await fireEvent.click(screen.getByRole("button", { name: /Ana Anić/ }));
  await settle();
};

describe("AccountMenu", () => {
  it("shows who is signed in and opens a list with the contributed entries first, then Language and Sign out", async () => {
    await startShell(shell, { features: [menuFeature], session });

    const trigger = screen.getByRole("button", { name: /Ana Anić/ });
    expect(trigger.textContent).toContain("ana@example.com");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await open();

    const panel = screen.getByRole("dialog", { name: "Open user menu" });
    expect(within(panel).getAllByRole("link", { name: /My profile/ })).toHaveLength(1);
    const visible = Array.from(panel.querySelectorAll("a, button")).filter((row) => !row.closest('[style*="display: none"]'));
    const rows = visible.map((row) => row.textContent?.trim());
    expect(rows).toEqual(["My profile", "Dark mode", "LanguageEnglish", "Sign out"]);
  });

  it("falls back to the user's id when the application's user has no name", async () => {
    await startShell(shell, { session: signedIn(7) });
    expect(screen.getByRole("button", { name: /7/ })).toBeTruthy();
  });

  it("a switch stays open and reports the change; a link closes the menu and navigates", async () => {
    const { application } = await startShell(shell, { features: [menuFeature], session });
    await open();

    const toggle = screen.getByRole("switch", { name: "Dark mode" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    await fireEvent.click(toggle);
    await settle();
    expect(screen.getByRole("switch", { name: "Dark mode" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByRole("dialog", { name: "Open user menu" })).toBeTruthy();

    await fireEvent.click(screen.getByRole("link", { name: /My profile/ }));
    await settle();
    expect(application.router.currentRoute.value.name).toBe("other");
    expect(screen.queryByRole("dialog", { name: "Open user menu" })).toBeNull();
  });

  it("switches the language through the application and marks the current one", async () => {
    const { application } = await startShell(shell, { session });
    await open();

    const language = screen.getByRole("button", { name: /Language/ });
    expect(language.getAttribute("aria-expanded")).toBe("false");
    await fireEvent.click(language);
    const choices = screen.getAllByRole("button").filter((button) => button.hasAttribute("aria-current"));
    expect(choices.map((choice) => choice.textContent?.trim())).toEqual(["English"]);

    await fireEvent.click(screen.getByRole("button", { name: "Hrvatski" }));
    await settle();
    expect(application.locale.value).toBe("hr");
    expect(screen.getByRole("button", { name: /Odjava/ })).toBeTruthy(); // the library's texts follow
    expect(document.documentElement.lang).toBe("hr");
  });

  it("offers no language row when the application has one language", async () => {
    await startShell(shell, { session, extra: { locale: { supported: ["en"] } } });
    await open();
    expect(screen.queryByRole("button", { name: /Language/ })).toBeNull();
  });

  it("signs out: the session ends, the user lands on the login page and the menu is gone", async () => {
    const { application, backend } = await startShell(shell, { session });
    await open();

    await fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await settle();

    expect(backend.signOuts).toBe(1);
    expect(application.router.currentRoute.value.name).toBe("login");
    expect(screen.queryByRole("button", { name: /Ana Anić/ })).toBeNull();
  });

  it("tells the user when the server did not confirm the sign-out", async () => {
    const error = vi.spyOn(toast, "error").mockReturnValue(1);
    const { platform } = await startShell(shell, { session });
    vi.spyOn(platform.session, "signOut").mockRejectedValue(new Error("offline"));
    await open();

    await fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await settle();

    expect(error).toHaveBeenCalledWith("The server could not end your session. Try again.");
    error.mockRestore();
  });

  it("Escape closes the menu and gives the focus back to its button", async () => {
    await startShell(shell, { session });
    await open();
    expect(screen.getByRole("dialog", { name: "Open user menu" })).toBeTruthy();

    await fireEvent.keyDown(window, { key: "Escape" });
    await settle();

    expect(screen.queryByRole("dialog", { name: "Open user menu" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Ana Anić/ }));
  });

  it("a row used outside an account menu says what it needs", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => {
      // Mounted by hand: there is no account menu around it.
      createApp({ render: () => h(AccountMenuItem, { label: "x" }) }).mount(document.createElement("div"));
    }).toThrow(/vue-core\.accountMenu/);
    warn.mockRestore();
  });
});

describe("AccountSheet", () => {
  const sheetShell = {
    slots: ["accountMenu"] as const,
    component: defineComponent({
      setup() {
        const identity = useShellIdentity();
        const sheet = ref<InstanceType<typeof AccountSheet> | null>(null);
        return () => h("div", [
          h("button", { onClick: () => sheet.value?.present() }, "account"),
          identity.value && h(AccountSheet, { ref: sheet, identity: identity.value }),
          h("main", [h(AppRouterView)]),
        ]);
      },
    }),
  };

  it("shows the same list in a sheet titled with the user's name and closes it on Sign out", async () => {
    const { backend } = await startShell(sheetShell, { features: [menuFeature], session });
    await fireEvent.click(screen.getByRole("button", { name: "account" }));
    await settle();

    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("Ana Anić")).toBeTruthy();
    expect(within(sheet).getByRole("link", { name: /My profile/ })).toBeTruthy();
    expect(within(sheet).getByRole("switch", { name: "Dark mode" })).toBeTruthy();

    await fireEvent.click(within(sheet).getByRole("button", { name: "Sign out" }));
    await settle();
    expect(backend.signOuts).toBe(1);
  });
});

describe("HeaderAction", () => {
  it("is a named button with a decorative badge, or a link", async () => {
    const clicked = vi.fn();
    const bar = {
      slots: ["headerActions"] as const,
      component: defineComponent({ render: () => h("div", [h(ShellOutlet, { name: "headerActions" }), h(AppRouterView)]) }),
    };
    const bell = defineComponent({ render: () => h(HeaderAction, { label: "Notifications, 3 unread", icon: "search", badge: 3, onClick: clicked }) });
    const help = defineComponent({ render: () => h(HeaderAction, { label: "Help", icon: "informationLine", badge: "dot", to: { name: "other" } }) });
    const { application } = await startShell(bar, {
      features: [defineFeature({ id: "actions", contributions: [
        { id: "bell", slot: "headerActions", component: bell, scope: "authenticated", order: 1 },
        { id: "help", slot: "headerActions", component: help, scope: "authenticated", order: 2 },
      ] })],
    });

    const button = screen.getByRole("button", { name: "Notifications, 3 unread" });
    expect(button.querySelector("[data-header-action-badge]")!.getAttribute("aria-hidden")).toBe("true");
    await fireEvent.click(button);
    expect(clicked).toHaveBeenCalledTimes(1);

    await fireEvent.click(screen.getByRole("link", { name: "Help" }));
    await settle();
    expect(application.router.currentRoute.value.name).toBe("other");
  });
});
