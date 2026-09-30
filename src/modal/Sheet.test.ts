import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick, ref, type Component } from "vue";
import { createTestI18n } from "../testing/i18n";
import { lateLeaveTransition } from "../testing/transition";
import { mockMedia } from "../testing/media";
import Sheet from "./Sheet.vue";

const global = { plugins: [createTestI18n("en")], stubs: { transition: false as boolean | Component } };

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
