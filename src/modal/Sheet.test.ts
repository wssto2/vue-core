import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick, ref, type Component } from "vue";
import { createTestI18n } from "../testing/i18n";
import { lateLeaveTransition } from "../testing/transition";
import { mockMedia } from "../testing/media";
import Sheet from "./Sheet.vue";

const global = { plugins: [createTestI18n()], stubs: { transition: false as boolean | Component } };

function mountSheet(props: Record<string, unknown> = {}, footer = false) {
  const Owner = defineComponent({
    components: { Sheet },
    setup: () => ({ sheet: ref<InstanceType<typeof Sheet> | null>(null), props }),
    template: `
      <button id="trigger" @click="sheet?.present()">Open</button>
      <Sheet ref="sheet" title="Filters" v-bind="props"><input id="field" />${footer ? '<template #footer><button>Apply</button></template>' : ""}</Sheet>`,
  });
  return render(Owner, { global });
}

const settle = async () => {
  await nextTick();
  await nextTick();
};

async function open() {
  document.querySelector<HTMLElement>("#trigger")!.focus();
  await fireEvent.click(document.querySelector("#trigger")!);
  await settle();
}

const press = (key: string) => document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
});

describe("Sheet", () => {
  it("is a named modal dialog that takes focus on the panel, not on a field", async () => {
    mountSheet();
    await open();

    const dialog = screen.getByRole("dialog");
    expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent).toBe("Filters");
    expect(document.activeElement).toBe(document.querySelector("[data-part=panel]"));
  });

  it("is a slide-over on a wide screen and a bottom sheet on a coarse pointer", async () => {
    mountSheet();
    await open();
    expect(document.querySelector("[data-part=panel]")!.className).toContain("inset-y-0");
    press("Escape");
    await vi.waitFor(() => expect(document.querySelector("[data-part=panel]")).toBeNull());

    const media = mockMedia({ compact: true });
    try {
      document.body.innerHTML = "";
      mountSheet();
      await open();
      expect(document.querySelector("[data-part=panel]")!.className).toContain("rounded-t-sheet");
    } finally {
      media.restore();
    }
  });

  it("dismisses with Escape, the close button and the scrim, restoring focus each time", async () => {
    const onDismissed = vi.fn();
    mountSheet({ onDismissed });

    await open();
    press("Escape");
    await vi.waitFor(() => expect(onDismissed).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(document.activeElement?.id).toBe("trigger"));

    await open();
    await fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await vi.waitFor(() => expect(onDismissed).toHaveBeenCalledTimes(2));

    await open();
    await fireEvent.click(document.querySelector(".bg-scrim")!);
    await vi.waitFor(() => expect(onDismissed).toHaveBeenCalledTimes(3));
  });

  it("locks the page while open and traps Tab inside", async () => {
    mountSheet({}, true);
    await open();
    expect(document.body.classList.contains("overflow-hidden")).toBe(true);

    screen.getByRole("button", { name: "Apply" }).focus();
    press("Tab");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
  });

  it("renders its footer slot and only then a footer", async () => {
    mountSheet({}, true);
    await open();
    expect(screen.getByRole("button", { name: "Apply" })).toBeTruthy();
  });

  it("reads the grouped canvas when asked", async () => {
    mountSheet({ grouped: true });
    await open();
    expect(document.querySelector("[data-part=panel]")!.className).toContain("bg-surface-page");
  });
});

// arv-next's Sheet, Modal and AlertDialog unmounted themselves when a leave transition ended,
// even if they had been presented again meanwhile: the dialog vanished while open.
describe("presenting again during the leave transition", () => {
  it("keeps the sheet on screen", async () => {
    global.stubs.transition = lateLeaveTransition(30);
    try {
      mountSheet();
      await open();
      press("Escape");
      await nextTick();
      await open();
      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(document.querySelector("[data-part=panel]")).not.toBeNull();
      expect(screen.getByRole("dialog")).toBeTruthy();
    } finally {
      global.stubs.transition = false;
    }
  });
});

describe("Sheet drag", () => {
  let media: ReturnType<typeof mockMedia>;
  beforeEach(() => {
    media = mockMedia({ compact: true });
  });
  afterEach(() => media.restore());

  it("is a bottom sheet with a grabber", async () => {
    mountSheet();
    await open();
    expect(document.querySelector("[data-part=panel] .h-1\\.25")).not.toBeNull();
  });
});

describe("Sheet size and docked", () => {
  it("is as wide as its size says on a wide screen", async () => {
    for (const [size, width] of [["md", "max-w-md"], ["lg", "max-w-xl"], ["xl", "max-w-3xl"]] as const) {
      document.body.innerHTML = "";
      mountSheet({ size });
      await open();
      expect(document.querySelector("[data-part=panel]")!.className).toContain(width);
    }
  });

  function mountDocked(props: Record<string, unknown> = {}) {
    const Owner = defineComponent({
      components: { Sheet },
      setup: () => ({ sheet: ref<InstanceType<typeof Sheet> | null>(null), props }),
      template: `
        <div id="layout" class="flex">
          <main id="page"><input id="page-field" /><button id="trigger" @click="sheet?.present()">Edit</button></main>
          <Sheet ref="sheet" title="Component" docked v-bind="props"><input id="sheet-field" /></Sheet>
        </div>`,
    });
    return render(Owner, { global });
  }

  it("sits in the layout beside the page: no scrim, no dialog, no scroll lock, nothing inert", async () => {
    mountDocked();
    await open();
    const region = screen.getByRole("region", { name: "Component" });
    expect(document.querySelector("#layout")!.contains(region)).toBe(true);
    expect(document.querySelector("[aria-modal]")).toBeNull();
    expect(document.querySelector(".bg-scrim")).toBeNull();
    expect(document.body.classList.contains("overflow-hidden")).toBe(false);
    expect(document.querySelector("#layout")!.hasAttribute("inert")).toBe(false);
    expect(document.querySelector("#page")!.closest("[inert]")).toBeNull();
    expect(region.className).toContain("w-md");
  });

  it("does not trap focus: Tab leaves the panel, and the page keeps working", async () => {
    mountDocked();
    await open();
    const field = document.querySelector<HTMLInputElement>("#sheet-field")!;
    field.focus();
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    field.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
    document.querySelector<HTMLInputElement>("#page-field")!.focus();
    expect(document.activeElement).toBe(document.querySelector("#page-field"));
    expect(screen.queryByRole("region", { name: "Component" })).not.toBeNull();
  });

  it("closes on Escape from inside it, and gives focus back to what opened it", async () => {
    mountDocked();
    await open();
    const dismissed = document.querySelector<HTMLElement>("[data-part=panel]")!;
    dismissed.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(screen.queryByRole("region", { name: "Component" })).toBeNull());
    expect(document.activeElement).toBe(document.querySelector("#trigger"));
  });

  it("leaves Escape alone while focus is on the page", async () => {
    mountDocked();
    await open();
    document.querySelector<HTMLInputElement>("#page-field")!.focus();
    press("Escape");
    await settle();
    expect(screen.queryByRole("region", { name: "Component" })).not.toBeNull();
  });

  it("is an ordinary bottom sheet on a coarse pointer", async () => {
    const media = mockMedia({ compact: true });
    try {
      mountDocked();
      await open();
      expect(screen.getByRole("dialog")).toBeTruthy();
      expect(document.querySelector(".bg-scrim")).not.toBeNull();
    } finally {
      media.restore();
    }
  });
});

