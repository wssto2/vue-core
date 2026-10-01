import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick, ref, type Component } from "vue";
import Modal from "../modal/Modal.vue";
import { createTestI18n } from "../testing/i18n";
import { lateLeaveTransition } from "../testing/transition";
import { mockMedia } from "../testing/media";
import AlertDialog from "./AlertDialog.vue";

const global = { plugins: [createTestI18n()], stubs: { transition: false as boolean | Component } };

/** The wide (alert) presentation unless a test turns compact on. */
function mountAlert(props: Record<string, unknown> = {}, subject?: unknown) {
  const Owner = defineComponent({
    components: { AlertDialog },
    setup: () => ({ dialog: ref<{ present: (about?: unknown) => void } | null>(null), props, subject }),
    template: `
      <div>
        <button id="trigger" @click="dialog?.present(subject)">Open</button>
        <AlertDialog ref="dialog" title="Delete record" message="This cannot be undone." confirm-label="Delete" v-bind="props" />
      </div>`,
  });
  return render(Owner, { global });
}

const settle = async () => {
  await nextTick();
  await nextTick();
};

async function open() {
  document.querySelector<HTMLElement>("#trigger")?.focus();
  await fireEvent.click(document.querySelector("#trigger")!);
  await settle();
}

const press = (key: string) => document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
const confirmButton = () => screen.getByRole("button", { name: "Delete" });
const cancelButton = () => screen.getByRole("button", { name: "Cancel" });

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
});

describe("AlertDialog", () => {
  it("is an alertdialog named by its title and described by its message, focusing the safe choice", async () => {
    mountAlert({ tone: "critical" });
    await open();

    const dialog = screen.getByRole("alertdialog");
    expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent).toBe("Delete record");
    expect(document.getElementById(dialog.getAttribute("aria-describedby")!)?.textContent).toBe("This cannot be undone.");
    expect(document.activeElement).toBe(cancelButton());
    expect(confirmButton().className).toContain("bg-status-danger-solid");
  });

  it("cancels on Escape, tells it closed, and restores focus", async () => {
    const onCancel = vi.fn();
    const onDismissed = vi.fn();
    mountAlert({ onCancel, onDismissed });
    await open();

    press("Escape");
    await vi.waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDismissed).toHaveBeenCalledTimes(1);
    expect(document.activeElement?.id).toBe("trigger");
  });

  it("confirm emits confirm with what the question was about and closes", async () => {
    const onConfirm = vi.fn();
    mountAlert({ onConfirm }, { id: 7 });
    await open();

    await fireEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledWith({ id: 7 });
    await vi.waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("stays on screen when presented again during the leave transition", async () => {
    global.stubs.transition = lateLeaveTransition(30);
    try {
      mountAlert();
      await open();
      press("Escape");
      await nextTick();
      await open();
      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(screen.getByRole("alertdialog")).toBeTruthy();
    } finally {
      global.stubs.transition = false;
    }
  });

  // arv-next's DeleteModal ignored `show(0)` and `show("")`: a falsy subject was "nothing to delete".
  it("hands any subject on, a falsy one included", async () => {
    const onConfirm = vi.fn();
    mountAlert({ onConfirm }, 0);
    await open();

    await fireEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledWith(0);
  });

  it("the default confirm label is Confirm", async () => {
    mountAlert({ confirmLabel: undefined });
    await open();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeTruthy();
  });

  it("stacks long choices instead of wrapping them", async () => {
    mountAlert({ confirmLabel: "Discard changes", cancelLabel: "Continue editing" });
    await open();

    expect(screen.getByRole("button", { name: "Continue editing" }).className).toContain("order-last");
  });

  it("uses the tone's tile and icon; a plain question carries no warning triangle", async () => {
    mountAlert({ tone: "neutral" });
    await open();
    const tile = screen.getByRole("alertdialog").querySelector("[aria-hidden='true'].size-11")!;

    expect(tile.className).toContain("bg-tint-soft");
    expect(tile.querySelector("path")?.getAttribute("d")).not.toContain("M10.29 3.86");
  });

  describe("with an action", () => {
    it("runs it with the buttons busy, then emits confirm and closes", async () => {
      let finish!: () => void;
      const action = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
      const onConfirm = vi.fn();
      mountAlert({ action, onConfirm }, "row");
      await open();

      await fireEvent.click(confirmButton());
      expect(action).toHaveBeenCalledWith("row");
      expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);
      expect((cancelButton() as HTMLButtonElement).disabled).toBe(true);
      expect(onConfirm).not.toHaveBeenCalled();

      finish();
      await vi.waitFor(() => expect(onConfirm).toHaveBeenCalledWith("row"));
      await vi.waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    });

    it("ignores Escape and a second confirm while busy", async () => {
      const action = vi.fn(() => new Promise<void>(() => {}));
      const onCancel = vi.fn();
      mountAlert({ action, onCancel });
      await open();

      await fireEvent.click(confirmButton());
      await fireEvent.click(confirmButton());
      press("Escape");
      expect(action).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
      expect(screen.getByRole("alertdialog")).toBeTruthy();
    });

    // arv-next's ConfirmModal caught a failing callback, then emitted `confirm` and closed anyway:
    // the user saw a success that never happened.
    it("a failing action keeps the dialog open, emits failed and not confirm, and can be retried", async () => {
      const boom = new Error("boom");
      const action = vi.fn().mockRejectedValueOnce(boom).mockResolvedValue(undefined);
      const onFailed = vi.fn();
      const onConfirm = vi.fn();
      mountAlert({ action, onFailed, onConfirm });
      await open();

      await fireEvent.click(confirmButton());
      await vi.waitFor(() => expect(onFailed).toHaveBeenCalledWith(boom));
      expect(onConfirm).not.toHaveBeenCalled();
      expect(screen.getByRole("alertdialog")).toBeTruthy();
      expect((confirmButton() as HTMLButtonElement).disabled).toBe(false);

      await fireEvent.click(confirmButton());
      await vi.waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    });
  });

  describe("compact: an action sheet", () => {
    let media: ReturnType<typeof mockMedia>;
    beforeEach(() => {
      media = mockMedia({ compact: true });
    });
    afterEach(() => media.restore());

    it("slides the choices up and cancels on a tap on the scrim", async () => {
      const onCancel = vi.fn();
      mountAlert({ presentation: "action-sheet", onCancel, tone: "critical" });
      await open();

      expect(document.querySelector("[data-presentation]")?.getAttribute("data-presentation")).toBe("action-sheet");
      expect(confirmButton().className).toContain("text-content-destructive");
      await fireEvent.click(document.querySelector(".bg-scrim")!);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("stays a centred alert on a phone when asked", async () => {
      mountAlert({ presentation: "alert" });
      await open();
      expect(document.querySelector("[data-presentation]")?.getAttribute("data-presentation")).toBe("alert");
    });
  });
});

describe("stacking", () => {
  const Stack = defineComponent({
    components: { Modal, AlertDialog },
    setup: () => ({ modal: ref<InstanceType<typeof Modal> | null>(null), alert: ref<{ present: () => void } | null>(null) }),
    template: `
      <div>
        <button id="trigger" @click="modal?.present()">Open</button>
        <Modal ref="modal" title="Edit" without-footer>
          <button id="ask" @click="alert?.present()">Ask</button>
        </Modal>
        <AlertDialog ref="alert" title="Sure?" confirm-label="Yes" />
      </div>`,
  });

  it("an alert opens above a dialog: it takes the Escape and the focus, and the dialog survives", async () => {
    render(Stack, { global });
    await open();
    document.querySelector<HTMLElement>("#ask")!.focus();
    await fireEvent.click(document.querySelector("#ask")!);
    await settle();

    const modal = document.querySelector<HTMLElement>("[role=dialog]")!;
    const alert = document.querySelector<HTMLElement>("[role=alertdialog]")!;
    expect(modal.closest("[inert]")).not.toBeNull();
    expect(alert.closest("[inert]")).toBeNull();
    expect(alert.className).toContain("z-10000");
    expect(modal.className).toContain("z-9999");

    press("Escape");
    await vi.waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.activeElement?.id).toBe("ask");
    expect(modal.closest("[inert]")).toBeNull();
  });
});
