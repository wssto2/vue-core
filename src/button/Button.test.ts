import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import Button from "./Button.vue";

function makeRouter() {
  const view = defineComponent({ render: () => h("div") });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: view },
      { name: "lead", path: "/leads/:id", component: view },
    ],
  });
  return router;
}

describe("Button", () => {
  it("is a button that does not submit unless asked to", () => {
    render(Button, { slots: { default: "Save" } });
    expect(screen.getByRole("button", { name: "Save" }).getAttribute("type")).toBe("button");
  });

  it("submits when its type says so", () => {
    render(Button, { props: { type: "submit" }, slots: { default: "Send" } });
    expect(screen.getByRole("button").getAttribute("type")).toBe("submit");
  });

  it("states intent through prominence and tone, every combination defined", () => {
    const seen = new Set<string>();
    for (const prominence of ["primary", "secondary", "standard", "plain", "link"] as const) {
      for (const tone of [undefined, "critical"] as const) {
        const { container, unmount } = render(Button, { props: { prominence, tone }, slots: { default: "x" } });
        const classes = container.querySelector("button")!.className;
        expect(classes).toMatch(/bg-(tint|fill|status|transparent)/);
        seen.add(classes);
        unmount();
      }
    }
    expect(seen.size).toBe(10);
  });

  it("uses the semantic roles, never a palette step", () => {
    const { container } = render(Button, { props: { prominence: "primary" }, slots: { default: "x" } });
    expect(container.querySelector("button")!.className).not.toMatch(/(?:primary|gray|red|green)-\d{2,3}/);
  });

  it("emits click, and emits nothing while disabled or processing", async () => {
    const onClick = vi.fn();
    const { rerender } = render(Button, { props: { onClick }, slots: { default: "Go" } });

    await fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);

    await rerender({ disabled: true });
    await fireEvent.click(screen.getByRole("button"));
    await rerender({ disabled: false, processing: true });
    await fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("true");
  });

  describe("waiting", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("shows a spinner in place of the icon only once the wait lasted 0.3 s", async () => {
      const { rerender, container } = render(Button, { props: { icon: "save" }, slots: { default: "Save" } });
      await rerender({ processing: true });
      expect(container.querySelector('[data-test="button-spinner"]')).toBeNull();

      await vi.advanceTimersByTimeAsync(300);
      expect(container.querySelector('[data-test="button-spinner"]')).not.toBeNull();
      expect(container.querySelectorAll("svg")).toHaveLength(1);

      await rerender({ processing: false });
      expect(container.querySelector('[data-test="button-spinner"]')).toBeNull();
    });
  });

  describe("as a link", () => {
    it("renders a real link to a route and navigates on click", async () => {
      const router = makeRouter();
      await router.push("/");
      render(Button, { props: { to: { name: "lead", params: { id: 7 } } }, slots: { default: "Open" }, global: { plugins: [router] } });

      const link = screen.getByRole("link", { name: "Open" });
      expect(link.getAttribute("href")).toBe("/leads/7");

      await fireEvent.click(link);
      await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe("/leads/7"));
    });

    // arv-next's CustomButton returned early from its click handler but let the router-link
    // navigate: a disabled link button still took the user away.
    it("does not navigate while disabled, and is no longer an address", async () => {
      const router = makeRouter();
      await router.push("/");
      render(Button, { props: { to: "/leads/7", disabled: true }, slots: { default: "Open" }, global: { plugins: [router] } });

      const link = screen.getByText("Open");
      expect(link.getAttribute("href")).toBeNull();
      expect(link.getAttribute("aria-disabled")).toBe("true");
      expect(link.getAttribute("tabindex")).toBe("-1");

      await fireEvent.click(link);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(router.currentRoute.value.fullPath).toBe("/");
    });

    it("renders a plain anchor for href", () => {
      render(Button, { props: { href: "tel:+38512345" }, slots: { default: "Call" } });
      expect(screen.getByRole("link", { name: "Call" }).getAttribute("href")).toBe("tel:+38512345");
    });
  });

  describe("keyboard shortcut", () => {
    const press = (init: KeyboardEventInit, target: EventTarget = document.body) =>
      target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));

    it("fires on its combination and swallows the key", async () => {
      const onClick = vi.fn();
      render(Button, { props: { onClick, keyboardShortcut: { key: "s", ctrlKey: true } }, slots: { default: "Save" } });

      const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true });
      window.dispatchEvent(event);
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
    });

    // arv-next compared event.key with the lower-cased shortcut key: with Shift held, key is "S".
    it("matches the key whatever its case", () => {
      const onClick = vi.fn();
      render(Button, { props: { onClick, keyboardShortcut: { key: "s", shiftKey: true } }, slots: { default: "Save" } });

      press({ key: "S", shiftKey: true });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("needs exactly its modifiers", () => {
      const onClick = vi.fn();
      render(Button, { props: { onClick, keyboardShortcut: { key: "s", ctrlKey: true } }, slots: { default: "Save" } });

      press({ key: "s" });
      press({ key: "s", ctrlKey: true, shiftKey: true });
      expect(onClick).not.toHaveBeenCalled();
    });

    // arv-next fired a plain-letter shortcut while the user typed that letter into a field.
    it("leaves plain keys alone while typing, but not Ctrl combinations", () => {
      const plain = vi.fn();
      const combo = vi.fn();
      render(Button, { props: { onClick: plain, keyboardShortcut: { key: "n" } }, slots: { default: "New" } });
      render(Button, { props: { onClick: combo, keyboardShortcut: { key: "k", ctrlKey: true } }, slots: { default: "Find" } });
      const input = document.body.appendChild(document.createElement("input"));

      press({ key: "n" }, input);
      press({ key: "k", ctrlKey: true }, input);
      expect(plain).not.toHaveBeenCalled();
      expect(combo).toHaveBeenCalledTimes(1);
      input.remove();
    });

    it("does not fire while disabled or busy, and leaves the key alone", async () => {
      const onClick = vi.fn();
      render(Button, { props: { onClick, disabled: true, keyboardShortcut: { key: "s", ctrlKey: true } }, slots: { default: "Save" } });

      const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true });
      window.dispatchEvent(event);
      expect(onClick).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it("does not fire for a button behind a dialog (inert page)", () => {
      const onClick = vi.fn();
      const host = document.body.appendChild(document.createElement("div"));
      render(Button, { props: { onClick, keyboardShortcut: { key: "s", ctrlKey: true } }, slots: { default: "Save" }, container: host });
      host.inert = true;

      press({ key: "s", ctrlKey: true });
      expect(onClick).not.toHaveBeenCalled();
      host.remove();
    });

    it("follows a changed shortcut and stops when unmounted", async () => {
      const onClick = vi.fn();
      const { rerender, unmount } = render(Button, { props: { onClick, keyboardShortcut: { key: "a", ctrlKey: true } }, slots: { default: "x" } });

      await rerender({ keyboardShortcut: { key: "b", ctrlKey: true } });
      press({ key: "a", ctrlKey: true });
      expect(onClick).not.toHaveBeenCalled();
      press({ key: "b", ctrlKey: true });
      expect(onClick).toHaveBeenCalledTimes(1);

      unmount();
      press({ key: "b", ctrlKey: true });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("registers no global list of shortcuts (arv-next kept window.registeredKeyboardShortcuts)", () => {
      render(Button, { props: { keyboardShortcut: { key: "s", ctrlKey: true } }, slots: { default: "x" } });
      expect("registeredKeyboardShortcuts" in window).toBe(false);
    });
  });
});
