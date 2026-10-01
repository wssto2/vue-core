import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick, ref, type Component } from "vue";
import { mockMedia } from "../testing/media";
import { createTestI18n } from "../testing/i18n";
import { lateLeaveTransition } from "../testing/transition";
import { useOpenDialogCount } from "../overlay";
import Modal from "./Modal.vue";
import { modalPlacementKey } from "./placement";

// Real transitions (not test-utils stubs): the dialog stays mounted until its leave transition ends.
const global = { plugins: [createTestI18n()], stubs: { transition: false as boolean | Component } };

/**
 * Modal teleports into <body>, so these mount attached to the document: focus, `inert` and
 * `document.activeElement` are the behaviour under test and none of them mean anything detached.
 */
function mountModal(slot: string, props: Record<string, unknown> = {}) {
  const Owner = defineComponent({
    components: { Modal },
    setup: () => ({ modal: ref<InstanceType<typeof Modal> | null>(null), props }),
    template: `
      <div>
        <button id="trigger" @click="modal?.present()">Open</button>
        <Modal ref="modal" v-bind="props" title="Test dialog">${slot}</Modal>
      </div>`,
  });
  return render(Owner, { global });
}

const settle = async () => {
  await nextTick();
  await nextTick();
};

const present = async () => {
  // A click does not move focus the way a real pointer press does in this DOM, and focus
  // restoration is exactly what some of these tests assert.
  document.querySelector<HTMLElement>("#trigger")?.focus();
  await fireEvent.click(document.querySelector("#trigger")!);
  await settle();
};

const press = (key: string, shiftKey = false) =>
  document.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true }));

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
});

describe("focus and dialog stacking", () => {
  it("focuses the first enabled control and skips disabled ones", async () => {
    mountModal('<button id="off" disabled>Off</button><input id="name" />');
    await present();

    expect(document.activeElement?.id).toBe("name");
  });

  it("focuses the dialog itself when it has nothing focusable", async () => {
    mountModal("<p>Nothing to focus</p>", { withoutFooter: true, withoutCloseButton: true });
    await present();

    expect(document.activeElement?.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(document.querySelector("[data-part=panel]"));
  });

  it("wraps Tab and Shift+Tab inside the dialog", async () => {
    mountModal('<input id="first" /><input id="last" />', { withoutFooter: true, withoutCloseButton: true });
    await present();

    document.querySelector<HTMLElement>("#last")?.focus();
    press("Tab");
    expect(document.activeElement?.id).toBe("first");
    press("Tab", true);
    expect(document.activeElement?.id).toBe("last");
  });

  it("pulls focus back when it has escaped to the background", async () => {
    mountModal('<input id="first" />', { withoutFooter: true, withoutCloseButton: true });
    await present();

    document.body.focus();
    press("Tab");
    expect(document.activeElement?.id).toBe("first");
  });

  it("makes the background inert and locks scrolling while open, and releases both on close", async () => {
    const root = document.createElement("div");
    root.innerHTML = '<button id="background">Background</button>';
    document.body.append(root);
    mountModal('<input id="name" />');
    await present();

    expect(root.inert).toBe(true);
    expect(document.body.classList.contains("overflow-hidden")).toBe(true);

    press("Escape");
    await settle();
    expect(root.inert).toBe(false);
    expect(document.body.classList.contains("overflow-hidden")).toBe(false);
  });

  // arv-next's stack wrote `child.inert = false` to every body child, undoing whoever else had set it.
  it("releases only what it made inert, and keeps an element that was inert already", async () => {
    const already = document.body.appendChild(document.createElement("div"));
    already.inert = true;
    const other = document.body.appendChild(document.createElement("div"));
    mountModal('<input id="name" />');
    await present();
    expect(other.inert).toBe(true);

    press("Escape");
    await settle();
    expect(other.inert).toBe(false);
    expect(already.inert).toBe(true);
  });

  it("does not remove a scroll lock somebody else applied", async () => {
    document.body.classList.add("overflow-hidden");
    mountModal('<input id="name" />');
    await present();
    press("Escape");
    await settle();

    expect(document.body.classList.contains("overflow-hidden")).toBe(true);
  });

  it("never marks an opted-out overlay inert", async () => {
    const overlay = document.body.appendChild(document.createElement("div"));
    overlay.setAttribute("data-dialog-inert-skip", "");
    mountModal('<input id="name" />');
    await present();

    expect(overlay.inert).toBe(false);
  });

  it("restores focus to the trigger on close", async () => {
    mountModal('<input id="name" />');
    await present();
    press("Escape");
    await settle();

    expect(document.activeElement?.id).toBe("trigger");
  });
});

describe("presentation", () => {
  it("is a named modal dialog", async () => {
    mountModal("<p>Body</p>");
    await present();

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent).toBe("Test dialog");
  });

  // arv-next pointed aria-labelledby at the title's id whenever a header slot existed, title or not.
  it("does not label itself by a title that does not exist", async () => {
    const Owner = defineComponent({
      components: { Modal },
      setup: () => ({ modal: ref<InstanceType<typeof Modal> | null>(null) }),
      template: `<button id="trigger" @click="modal?.present()">o</button><Modal ref="modal" without-footer><template #header><p>Steps</p></template><input /></Modal>`,
    });
    render(Owner, { global });
    await present();

    expect(screen.getByRole("dialog").hasAttribute("aria-labelledby")).toBe(false);
  });

  it("never gives the close button initial focus and closes through it", async () => {
    mountModal('<input id="name" />', { withoutFooter: true });
    await present();

    expect(document.activeElement?.id).toBe("name");
    await fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await vi.waitFor(() => expect(document.querySelector("#name")).toBeNull());
  });

  it("puts the primary action in the footer, between Cancel and the content, and emits primary", async () => {
    const onPrimary = vi.fn();
    mountModal("<p>Body</p>", { primaryLabel: "Save", onPrimary });
    await present();

    await fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("names the dismiss button Close when there is nothing to commit", async () => {
    mountModal("<p>Body</p>");
    await present();
    expect(screen.getAllByRole("button", { name: "Close" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("asks beforeDismiss for Escape, Cancel and the close button, and stays open when it refuses", async () => {
    const beforeDismiss = vi.fn().mockResolvedValue(false);
    mountModal('<input id="name" />', { beforeDismiss, primaryLabel: "Save" });
    await present();

    press("Escape");
    await vi.waitFor(() => expect(beforeDismiss).toHaveBeenCalledTimes(1));
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await vi.waitFor(() => expect(beforeDismiss).toHaveBeenCalledTimes(3));
    expect(document.querySelector("#name")).not.toBeNull();
  });

  it("closes without waiting a microtask when the guard answers synchronously", async () => {
    mountModal('<input id="name" />', { beforeDismiss: () => true });
    await present();

    press("Escape");
    expect(document.body.classList.contains("overflow-hidden")).toBe(false);
  });

  it("dismiss() resolves to whether the dialog closed", async () => {
    const allow = ref(false);
    const Owner = defineComponent({
      components: { Modal },
      setup: () => ({
        modal: ref<InstanceType<typeof Modal> | null>(null),
        allow,
        result: ref<boolean | null>(null),
      }),
      template: `
        <button id="open" @click="modal?.present()">o</button>
        <button id="close" @click="modal?.dismiss().then((closed) => (result = closed))">c</button>
        <Modal ref="modal" title="t" :before-dismiss="() => allow"><input id="field" /></Modal>
        <output>{{ result }}</output>`,
    });
    const { container } = render(Owner, { global });
    await fireEvent.click(container.querySelector("#open")!);
    await settle();

    await fireEvent.click(container.querySelector("#close")!);
    await vi.waitFor(() => expect(screen.getByRole("status").textContent).toBe("false"));
    expect(document.querySelector("#field")).not.toBeNull();

    allow.value = true;
    await fireEvent.click(container.querySelector("#close")!);
    await vi.waitFor(() => expect(screen.getByRole("status").textContent).toBe("true"));
    await vi.waitFor(() => expect(document.querySelector("#field")).toBeNull());
  });

  it("emits presented once it has focus, and dismissed once it closed, however it closed", async () => {
    const onPresented = vi.fn(() => expect(document.activeElement?.id).toBe("name"));
    const onDismissed = vi.fn();
    mountModal('<input id="name" />', { onPresented, onDismissed });
    await present();

    expect(onPresented).toHaveBeenCalledTimes(1);
    press("Escape");
    await settle();
    expect(onDismissed).toHaveBeenCalledTimes(1);
  });

  it("stays on screen when presented again during the leave transition", async () => {
    global.stubs.transition = lateLeaveTransition(30);
    try {
      mountModal('<input id="name" />');
      await present();
      press("Escape");
      await nextTick();
      await present();
      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(document.querySelector("#name")).not.toBeNull();
    } finally {
      global.stubs.transition = false;
    }
  });

  it("present() while open does nothing", async () => {
    const onPresented = vi.fn();
    mountModal("<p>Body</p>", { onPresented });
    await present();
    await present();

    expect(onPresented).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });
});

describe("waiting", () => {
  it("processing blocks the primary action and Cancel, and says what it is doing", async () => {
    mountModal("<p>Body</p>", { primaryLabel: "Search", status: "processing", processingLabel: "Searching…" });
    await present();

    const primary = screen.getByRole("button", { name: /Searching…/ });
    expect(primary.hasAttribute("disabled") || primary.getAttribute("aria-disabled") === "true").toBe(true);
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps Cancel usable while processing when abandoning is safe", async () => {
    mountModal("<p>Body</p>", { primaryLabel: "Search", status: "processing", cancellableWhileProcessing: true });
    await present();

    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("done shows the done label with a drawn check and blocks everything", async () => {
    mountModal("<p>Body</p>", { primaryLabel: "Save", status: "done", doneLabel: "Saved" });
    await present();

    const primary = screen.getByRole("button", { name: /Saved/ });
    expect(primary.querySelector("svg")).not.toBeNull();
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("draws a progress hairline when given progress", async () => {
    mountModal("<p>Body</p>", { progress: { value: 40 } });
    await present();

    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("40");
  });
});

describe("compact presentation: a page sheet", () => {
  let media: ReturnType<typeof mockMedia>;
  beforeEach(() => {
    media = mockMedia({ compact: true });
  });
  afterEach(() => media.restore());

  it("takes focus on the panel, not on a field, so no keyboard is raised", async () => {
    mountModal('<input id="name" />', { primaryLabel: "Save" });
    await present();

    expect(document.querySelector("[data-presentation]")?.getAttribute("data-presentation")).toBe("sheet");
    expect(document.activeElement).toBe(document.querySelector("[data-part=panel]"));
  });

  it("puts Cancel, the title and the primary action in the nav bar", async () => {
    const onPrimary = vi.fn();
    mountModal("<p>Body</p>", { primaryLabel: "Save", onPrimary });
    await present();

    expect(screen.getByRole("heading", { name: "Test dialog" })).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("nested dialogs", () => {
  const Nested = defineComponent({
    components: { Modal },
    setup: () => ({ outer: ref<InstanceType<typeof Modal> | null>(null), inner: ref<InstanceType<typeof Modal> | null>(null) }),
    template: `
      <div>
        <button id="trigger" @click="outer?.present()">Open</button>
        <Modal ref="outer" title="Outer" without-footer>
          <input id="outer-input" />
          <button id="open-inner" @click="inner?.present()">Nested</button>
        </Modal>
        <Modal ref="inner" title="Inner" without-footer><input id="inner-input" /></Modal>
      </div>`,
  });

  const openBoth = async () => {
    render(Nested, { global });
    await present();
    document.querySelector<HTMLElement>("#open-inner")?.focus();
    document.querySelector<HTMLElement>("#open-inner")?.click();
    await settle();
  };

  it("gives the nested dialog focus without making it inert, and makes its parent inert", async () => {
    await openBoth();

    const outerPanel = document.querySelector("#outer-input")?.closest("[tabindex='-1']");
    const innerPanel = document.querySelector("#inner-input")?.closest("[tabindex='-1']");
    expect(outerPanel?.closest("[inert]")).not.toBeNull();
    expect(innerPanel?.closest("[inert]")).toBeNull();
    expect(document.activeElement?.id).toBe("inner-input");
  });

  it("closes only the topmost dialog on Escape and keeps the page locked", async () => {
    await openBoth();

    press("Escape");
    await vi.waitFor(() => expect(document.querySelector("#inner-input")).toBeNull());
    expect(document.querySelector("#outer-input")).not.toBeNull();
    expect(document.body.classList.contains("overflow-hidden")).toBe(true);
    // Focus returns to the control that opened the nested dialog, possible only because the
    // parent was released from inertness first.
    expect(document.activeElement?.id).toBe("open-inner");

    press("Escape");
    await vi.waitFor(() => expect(document.querySelector("#outer-input")).toBeNull());
    expect(document.body.classList.contains("overflow-hidden")).toBe(false);
  });

  it("marks the dialog below a value sheet as covered", async () => {
    await openBoth();

    const panels = document.querySelectorAll<HTMLElement>("[data-part=panel]");
    expect(panels[0]?.hasAttribute("data-covered")).toBe(true);
    expect(panels[1]?.hasAttribute("data-covered")).toBe(false);

    press("Escape");
    await settle();
    expect(document.querySelector("[data-part=panel]")?.hasAttribute("data-covered")).toBe(false);
  });

  it("removes itself from the stack when its owner unmounts while open", async () => {
    const { unmount } = render(Nested, { global });
    await present();
    unmount();
    await settle();

    expect(document.body.classList.contains("overflow-hidden")).toBe(false);
    expect([...document.body.children].every((child) => !(child as HTMLElement).inert)).toBe(true);
  });
});

describe("placement", () => {
  const panel = () => document.querySelector<HTMLElement>('[data-part="panel"]')!;
  const lane = () => panel().parentElement!;

  it("is centred and unshifted by default", async () => {
    mountModal("<p>Body</p>");
    await present();
    expect(lane().classList.contains("items-center")).toBe(true);
    expect(panel().style.transform).toBe("");
  });

  it("aligns to the top and shifts sideways when the application says so, following a reactive value", async () => {
    const offset = ref(-120);
    const Owner = defineComponent({
      components: { Modal },
      setup: () => ({ modal: ref<InstanceType<typeof Modal> | null>(null) }),
      template: `<div><button id="trigger" @click="modal?.present()">Open</button><Modal ref="modal" title="T"><p>Body</p></Modal></div>`,
    });
    render(Owner, { global: { ...global, provide: { [modalPlacementKey as symbol]: () => ({ align: "top", offsetX: offset.value }) } } });
    await present();
    expect(lane().classList.contains("items-start")).toBe(true);
    expect(panel().style.transform).toBe("translateX(-120px)");
    offset.value = -80;
    await nextTick();
    expect(panel().style.transform).toBe("translateX(-80px)");
  });

  it("a modal's own placement wins over the application's, field by field", async () => {
    const Owner = defineComponent({
      components: { Modal },
      setup: () => ({ modal: ref<InstanceType<typeof Modal> | null>(null) }),
      template: `<div><button id="trigger" @click="modal?.present()">Open</button><Modal ref="modal" title="T" :placement="{ align: 'center' }"><p>Body</p></Modal></div>`,
    });
    render(Owner, { global: { ...global, provide: { [modalPlacementKey as symbol]: { align: "top", offsetX: -50 } } } });
    await present();
    expect(lane().classList.contains("items-center")).toBe(true);
    expect(panel().style.transform).toBe("translateX(-50px)");
  });
});

describe("open dialog count", () => {
  it("counts the dialogs that are open, nested ones included, and goes back to zero", async () => {
    const count = useOpenDialogCount();
    expect(count.value).toBe(0);
    mountModal("<p>Body</p>");
    await present();
    expect(count.value).toBe(1);
    press("Escape");
    await settle();
    expect(count.value).toBe(0);
  });
});
