import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick } from "vue";
import Modal from "../modal/Modal.vue";
import { createTestI18n } from "../testing/i18n";
import Tooltip from "./Tooltip.vue";

const settle = async () => {
  await nextTick();
  await nextTick();
};

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
});

describe("Tooltip", () => {
  const mount = (props: Record<string, unknown> = {}) =>
    render(Tooltip, {
      props: { text: "Copy the VIN", ...props },
      slots: { default: `<template #default="{ describedby }"><button :aria-describedby="describedby">Copy</button></template>` },
    });

  it("is hidden until the pointer rests on its element, then says its text", async () => {
    mount();
    expect(screen.queryByRole("tooltip")).toBeNull();

    await fireEvent.mouseEnter(screen.getByRole("button").parentElement!);
    await settle();
    expect(screen.getByRole("tooltip").textContent).toContain("Copy the VIN");
  });

  it("describes the element: aria-describedby points at the tooltip", async () => {
    mount();
    await fireEvent.mouseEnter(screen.getByRole("button").parentElement!);
    await settle();

    expect(screen.getByRole("button").getAttribute("aria-describedby")).toBe(screen.getByRole("tooltip").id);
  });

  // arv-next's Tooltip was hover only: a keyboard user never saw it.
  it("shows on keyboard focus and hides on blur", async () => {
    mount();
    await fireEvent.focusIn(screen.getByRole("button"));
    await settle();
    expect(screen.getByRole("tooltip")).toBeTruthy();

    await fireEvent.focusOut(screen.getByRole("button"));
    await settle();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("hides when the pointer leaves", async () => {
    mount();
    const anchor = screen.getByRole("button").parentElement!;
    await fireEvent.mouseEnter(anchor);
    await settle();
    await fireEvent.mouseLeave(anchor);
    await settle();

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("Escape dismisses it without closing anything else", async () => {
    mount();
    await fireEvent.focusIn(screen.getByRole("button"));
    await settle();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await settle();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  describe("with a delay", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("the pointer must rest first; keyboard focus shows it at once", async () => {
      mount({ delay: 400 });
      const anchor = screen.getByRole("button").parentElement!;

      await fireEvent.mouseEnter(anchor);
      await vi.advanceTimersByTimeAsync(399);
      expect(screen.queryByRole("tooltip")).toBeNull();
      await vi.advanceTimersByTimeAsync(1);
      expect(screen.getByRole("tooltip")).toBeTruthy();

      await fireEvent.mouseLeave(anchor);
      await fireEvent.mouseEnter(anchor);
      await fireEvent.mouseLeave(anchor);
      await vi.advanceTimersByTimeAsync(1000);
      expect(screen.queryByRole("tooltip")).toBeNull();

      await fireEvent.focusIn(screen.getByRole("button"));
      expect(screen.getByRole("tooltip")).toBeTruthy();
    });
  });

  it("shows nothing without text or content", async () => {
    mount({ text: null });
    await fireEvent.mouseEnter(screen.getByRole("button").parentElement!);
    await settle();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("takes rich content beside the text", async () => {
    render(Tooltip, { props: { text: "VIN" }, slots: { default: "<button>x</button>", content: "<b>WVWZZZ</b>" } });
    await fireEvent.mouseEnter(screen.getByRole("button").parentElement!);
    await settle();

    expect(screen.getByRole("tooltip").querySelector("b")?.textContent).toBe("WVWZZZ");
  });

  it("sits above a dialog and is not made inert by it", async () => {
    const Owner = defineComponent({
      components: { Modal, Tooltip },
      template: `<Modal ref="modal" title="Edit" without-footer><Tooltip text="Hint"><button id="hinted">?</button></Tooltip></Modal><button id="o" @click="$refs.modal.present()">o</button>`,
    });
    render(Owner, { global: { plugins: [createTestI18n("en")] } });
    await fireEvent.click(document.querySelector("#o")!);
    await settle();
    await fireEvent.focusIn(document.querySelector("#hinted")!);
    await settle();

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.className).toContain("z-10002");
    expect(tooltip.closest("[inert]")).toBeNull();
  });

  it("removes its listener when it unmounts while shown", async () => {
    const { unmount } = mount();
    await fireEvent.focusIn(screen.getByRole("button"));
    await settle();
    unmount();

    expect(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))).not.toThrow();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
