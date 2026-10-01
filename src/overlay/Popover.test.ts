import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick, ref } from "vue";
import Modal from "../modal/Modal.vue";
import { createTestI18n } from "../testing/i18n";
import Popover from "./Popover.vue";

const global = { plugins: [createTestI18n("en")], stubs: { transition: false } };

const settle = async () => {
  await nextTick();
  await nextTick();
  await nextTick();
};

function mountPopover(props = "") {
  const Owner = defineComponent({
    components: { Popover },
    setup: () => ({ popover: ref<InstanceType<typeof Popover> | null>(null) }),
    template: `
      <div>
        <Popover ref="popover" label="Save filter" ${props}>
          <template #trigger="{ toggle, attrs }"><button id="trigger" v-bind="attrs" @click="toggle">Save</button></template>
          <template #default="{ dismiss }"><input id="name" /><button id="done" @click="dismiss">Done</button></template>
        </Popover>
        <button id="elsewhere">Elsewhere</button>
      </div>`,
  });
  return render(Owner, { global });
}

async function toggle() {
  document.querySelector<HTMLElement>("#trigger")!.focus();
  await fireEvent.click(document.querySelector("#trigger")!);
  await settle();
}

const press = (key: string) => window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
});

describe("Popover", () => {
  it("is a named dialog opened by its trigger, which reports it", async () => {
    mountPopover();
    const trigger = screen.getByRole("button", { name: "Save" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await toggle();
    expect(screen.getByRole("dialog", { name: "Save filter" })).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-controls")).toBe(screen.getByRole("dialog").id);
  });

  it("focuses the first control inside", async () => {
    mountPopover();
    await toggle();
    expect(document.activeElement?.id).toBe("name");
  });

  it("the trigger toggles it closed again", async () => {
    mountPopover();
    await toggle();
    await toggle();
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Escape closes it and returns focus to the trigger", async () => {
    mountPopover();
    await toggle();
    press("Escape");
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await vi.waitFor(() => expect(document.activeElement?.id).toBe("trigger"));
  });

  it("while it fades out it lets clicks through to what is underneath", async () => {
    mountPopover();
    await toggle();
    const panel = screen.getByRole("dialog");
    press("Escape");
    await nextTick();
    // Still in the document during its leave transition: a click there belongs to the page below.
    expect(panel.isConnected).toBe(true);
    expect(panel.className).toContain("pointer-events-none");
  });

  it("closes on a press outside, without stealing focus", async () => {
    mountPopover();
    await toggle();
    const elsewhere = document.querySelector<HTMLElement>("#elsewhere")!;
    elsewhere.focus();
    elsewhere.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement?.id).toBe("elsewhere");
  });

  it("closes when focus moves out of it and its trigger", async () => {
    mountPopover();
    await toggle();
    const elsewhere = document.querySelector<HTMLElement>("#elsewhere")!;
    document.querySelector("#name")!.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: elsewhere }));

    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("offers dismiss to its content, which closes it and returns focus", async () => {
    mountPopover();
    await toggle();
    await fireEvent.click(screen.getByRole("button", { name: "Done" }));

    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await vi.waitFor(() => expect(document.activeElement?.id).toBe("trigger"));
  });

  it("emits presented and dismissed", async () => {
    const onPresented = vi.fn();
    const onDismissed = vi.fn();
    const Owner = defineComponent({
      components: { Popover },
      setup: () => ({ onPresented, onDismissed }),
      template: `<Popover label="x" @presented="onPresented" @dismissed="onDismissed"><template #trigger="{ toggle }"><button id="trigger" @click="toggle">t</button></template>body</Popover>`,
    });
    render(Owner, { global });
    await toggle();
    await toggle();

    expect(onPresented).toHaveBeenCalledTimes(1);
    expect(onDismissed).toHaveBeenCalledTimes(1);
  });

  it("inside a dialog, Escape closes the popover only", async () => {
    const Owner = defineComponent({
      components: { Popover, Modal },
      setup: () => ({ modal: ref<InstanceType<typeof Modal> | null>(null) }),
      template: `
        <button id="open" @click="modal?.present()">open</button>
        <Modal ref="modal" title="Edit" without-footer>
          <Popover label="Hint"><template #trigger="{ toggle, attrs }"><button id="trigger" v-bind="attrs" @click="toggle">t</button></template>body</Popover>
        </Modal>`,
    });
    render(Owner, { global });
    await fireEvent.click(document.querySelector("#open")!);
    await settle();
    await toggle();
    expect(screen.getAllByRole("dialog")).toHaveLength(2);

    press("Escape");
    await vi.waitFor(() => expect(screen.getAllByRole("dialog")).toHaveLength(1));
    expect(screen.getByRole("dialog").getAttribute("aria-label")).toBeNull();
  });

  it("renders in place (not teleported), so an enclosing dialog does not make it inert", async () => {
    const { container } = mountPopover();
    await toggle();
    expect(container.querySelector("[role=dialog]")).not.toBeNull();
  });

  it("its panel width is a union, not a class", async () => {
    mountPopover('width="sm"');
    await toggle();
    expect(screen.getByRole("dialog").className).toContain("w-56");
  });

  it("matchTriggerWidth makes the panel at least as wide as its trigger on wide screens, and leaves a narrow trigger at the panel's own width", async () => {
    const measure = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 420, height: 30, x: 0, y: 0, top: 0, left: 0, right: 420, bottom: 30, toJSON: () => ({}) });
    mountPopover('width="md" match-trigger-width');
    await toggle();
    await vi.waitFor(() => expect(screen.getByRole("dialog").style.minWidth).toBe("420px"));
    expect(screen.getByRole("dialog").className).toContain("w-72"); // a field narrower than that keeps the width it had
    measure.mockRestore();
  });

  it("has no minimum width unless asked", async () => {
    mountPopover('width="md"');
    await toggle();
    await settle();
    expect(screen.getByRole("dialog").style.minWidth).toBe("");
  });
});
