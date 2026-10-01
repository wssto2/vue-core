import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick, ref } from "vue";
import Modal from "../modal/Modal.vue";
import { createTestI18n } from "../testing/i18n";
import Menu, { type MenuItem } from "./Menu.vue";

const global = { plugins: [createTestI18n()], stubs: { transition: false } };

const settle = async () => {
  await nextTick();
  await nextTick();
  await nextTick();
};

function items(onSelect = vi.fn()): MenuItem[] {
  return [
    { id: "rename", label: "Rename", section: "edit", onSelect: () => onSelect("rename") },
    { id: "delete", label: "Delete", tone: "critical", onSelect: () => onSelect("delete") },
    { id: "copy", label: "Copy", section: "edit", shortcut: "⌘C", onSelect: () => onSelect("copy") },
    { id: "share", label: "Share", section: "share", disabled: true, onSelect: () => onSelect("share") },
    { id: "export", label: "Export", section: "share", onSelect: () => onSelect("export") },
  ];
}

function mountMenu(menuItems: MenuItem[] = items(), extra = "") {
  const Owner = defineComponent({
    components: { ActionMenu: Menu },
    setup: () => ({ menuItems, menu: ref<InstanceType<typeof Menu> | null>(null) }),
    template: `
      <div>
        <ActionMenu ref="menu" :items="menuItems" label="Actions">
          <template #trigger="{ toggle, attrs }"><button id="trigger" v-bind="attrs" @click="toggle">More</button></template>
        </ActionMenu>${extra}
      </div>`,
  });
  return render(Owner, { global });
}

async function openMenu() {
  document.querySelector<HTMLElement>("#trigger")!.focus();
  await fireEvent.click(document.querySelector("#trigger")!);
  await settle();
}

const press = (key: string, target: Element | Window = window) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
});

describe("Menu", () => {
  it("is a named menu opened by its trigger, which reports expanded", async () => {
    mountMenu();
    const trigger = screen.getByRole("button", { name: "More" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await openMenu();
    expect(screen.getByRole("menu", { name: "Actions" })).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-controls")).toBe(screen.getByRole("menu").id);
  });

  it("puts critical commands last in their own block and separates sections", async () => {
    mountMenu();
    await openMenu();

    const labels = screen.getAllByRole("menuitem").map((item) => item.querySelector(".truncate")?.textContent);
    expect(labels).toEqual(["Rename", "Copy", "Share", "Export", "Delete"]);
    expect(screen.getAllByRole("separator")).toHaveLength(2);
    expect(screen.getByRole("menuitem", { name: "Delete" }).className).toContain("text-content-destructive");
  });

  it("focuses the first item and moves with the arrow keys, Home and End, skipping disabled items", async () => {
    mountMenu();
    await openMenu();
    const menu = screen.getByRole("menu");

    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Rename" }));
    await fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Copy" }));
    await fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Export" }));
    await fireEvent.keyDown(menu, { key: "End" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Delete" }));
    await fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Rename" }));
    await fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Delete" }));
    await fireEvent.keyDown(menu, { key: "Home" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Rename" }));
  });

  it("Escape closes it and returns focus to the trigger", async () => {
    mountMenu();
    await openMenu();
    press("Escape");
    await vi.waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await vi.waitFor(() => expect(document.activeElement?.id).toBe("trigger"));
  });

  it("Tab leaves and closes", async () => {
    mountMenu();
    await openMenu();
    await fireEvent.keyDown(screen.getByRole("menu"), { key: "Tab" });
    await vi.waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("choosing returns focus to the trigger before the command runs, then runs it", async () => {
    const order: string[] = [];
    const onSelect = vi.fn(() => order.push(`select@${document.activeElement?.id}`));
    mountMenu(items(onSelect));
    await openMenu();

    await fireEvent.click(screen.getByRole("menuitem", { name: "Copy" }));
    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith("copy"));
    expect(order).toEqual(["select@trigger"]);
    await vi.waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("does not run a disabled or processing command", async () => {
    const onSelect = vi.fn();
    mountMenu([
      { id: "a", label: "Busy", processing: true, onSelect: () => onSelect("a") },
      { id: "b", label: "Off", disabled: true, onSelect: () => onSelect("b") },
      { id: "c", label: "On", onSelect: () => onSelect("c") },
    ]);
    await openMenu();

    await fireEvent.click(screen.getByRole("menuitem", { name: "Busy" }));
    await fireEvent.click(screen.getByRole("menuitem", { name: "Off" }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("menuitem", { name: "Busy" }).getAttribute("aria-busy")).toBe("true");
  });

  it("a choice among the items is a menuitemradio with aria-checked", async () => {
    mountMenu([
      { id: "a", label: "Split", checked: true, onSelect: () => {} },
      { id: "b", label: "Zagreb", checked: false, onSelect: () => {} },
    ]);
    await openMenu();

    expect(screen.getByRole("menuitemradio", { name: "Split" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("menuitemradio", { name: "Zagreb" }).getAttribute("aria-checked")).toBe("false");
  });

  it("closes on a press outside and does not open with nothing to show", async () => {
    mountMenu();
    await openMenu();
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    await vi.waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    document.body.innerHTML = "";
    mountMenu([]);
    await openMenu();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes when its items disappear (a permission changed)", async () => {
    const list = ref<MenuItem[]>(items());
    const Owner = defineComponent({
      components: { ActionMenu: Menu },
      setup: () => ({ list }),
      template: `<ActionMenu :items="list" label="Actions"><template #trigger="{ toggle, attrs }"><button id="trigger" v-bind="attrs" @click="toggle">More</button></template></ActionMenu>`,
    });
    render(Owner, { global });
    await openMenu();
    list.value = [];
    await vi.waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("opens as a context menu at a point and returns focus to what had it", async () => {
    const Owner = defineComponent({
      components: { ActionMenu: Menu },
      setup: () => ({ list: items(), menu: ref<InstanceType<typeof Menu> | null>(null) }),
      template: `<a id="row" href="#r" @contextmenu.prevent="menu?.presentAt(40, 60)">row</a><ActionMenu ref="menu" :items="list" label="Row actions" />`,
    });
    render(Owner, { global });
    document.querySelector<HTMLElement>("#row")!.focus();
    await fireEvent.contextMenu(document.querySelector("#row")!);
    await settle();

    expect(screen.getByRole("menu", { name: "Row actions" })).toBeTruthy();
    press("Escape");
    await vi.waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await vi.waitFor(() => expect(document.activeElement?.id).toBe("row"));
  });

  it("works above an open dialog: it is not inert and the dialog keeps the Escape that is not its", async () => {
    const Owner = defineComponent({
      components: { Modal, ActionMenu: Menu },
      setup: () => ({ list: items(), modal: ref<InstanceType<typeof Modal> | null>(null) }),
      template: `
        <button id="open" @click="modal?.present()">open</button>
        <Modal ref="modal" title="Edit" without-footer>
          <ActionMenu :items="list" label="In dialog">
            <template #trigger="{ toggle, attrs }"><button id="in-trigger" v-bind="attrs" @click="toggle">More</button></template>
          </ActionMenu>
        </Modal>`,
    });
    render(Owner, { global });
    await fireEvent.click(document.querySelector("#open")!);
    await settle();
    document.querySelector<HTMLElement>("#in-trigger")!.focus();
    await fireEvent.click(document.querySelector("#in-trigger")!);
    await settle();

    expect(screen.getByRole("menu").closest("[inert]")).toBeNull();
    press("Escape");
    await vi.waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
