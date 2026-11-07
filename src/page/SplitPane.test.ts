import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defineComponent, h, ref } from "vue";
import { createTestI18n } from "../testing/i18n";
import SplitPane from "./SplitPane.vue";

const global = { plugins: [createTestI18n()] };
const original = window.matchMedia;
const media = (matches: boolean) => {
  window.matchMedia = ((query: string) => ({ matches, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
};

function mount(props: Record<string, unknown> = {}) {
  const size = ref(0.5);
  const Host = defineComponent({
    setup: () => () =>
      h(SplitPane, { size: size.value, "onUpdate:size": (next: number) => (size.value = next), ...props }, { start: () => h("p", "code"), end: () => h("p", "preview") }),
  });
  return { ...render(Host, { global }), size };
}

beforeEach(() => {
  media(true);
  localStorage.clear();
});
afterEach(() => {
  window.matchMedia = original;
  document.body.innerHTML = "";
});

describe("SplitPane", () => {
  it("has a separator handle that reports the start pane's share", () => {
    mount();
    const handle = screen.getByRole("separator", { name: "Resize panes" });
    expect(handle.getAttribute("aria-valuenow")).toBe("50");
    expect(handle.getAttribute("aria-orientation")).toBe("vertical");
    expect(handle.getAttribute("tabindex")).toBe("0");
  });

  it("resizes from the keyboard: arrows by 2 %, Shift by 10 %, Home and End to the limits", async () => {
    const { size } = mount();
    const handle = screen.getByRole("separator");
    await fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(size.value).toBeCloseTo(0.52);
    expect(handle.getAttribute("aria-valuenow")).toBe("52");
    await fireEvent.keyDown(handle, { key: "ArrowLeft", shiftKey: true });
    expect(size.value).toBeCloseTo(0.42);
    await fireEvent.keyDown(handle, { key: "End" });
    expect(size.value).toBe(1);
    await fireEvent.keyDown(handle, { key: "Home" });
    expect(size.value).toBe(0);
  });

  it("a vertical split answers to ↑ and ↓, not ← and →", async () => {
    const { size } = mount({ orientation: "vertical" });
    const handle = screen.getByRole("separator");
    expect(handle.getAttribute("aria-orientation")).toBe("horizontal");
    await fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(size.value).toBe(0.5);
    await fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(size.value).toBeCloseTo(0.52);
  });

  it("remembers the size under its storage key and starts from it", async () => {
    const first = mount({ storageKey: "templates" });
    await fireEvent.keyDown(screen.getByRole("separator"), { key: "ArrowRight", shiftKey: true });
    expect(Number(localStorage.getItem("vue-core:split:templates"))).toBeCloseTo(0.6);
    first.unmount();

    const second = mount({ storageKey: "templates" });
    await Promise.resolve();
    expect(second.size.value).toBeCloseTo(0.6);
    expect(screen.getByRole("separator").getAttribute("aria-valuenow")).toBe("60");
  });

  it("works where storage is blocked", async () => {
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.getItem = () => { throw new Error("blocked"); };
    Storage.prototype.setItem = () => { throw new Error("blocked"); };
    try {
      const { size } = mount({ storageKey: "x" });
      await fireEvent.keyDown(screen.getByRole("separator"), { key: "ArrowRight" });
      expect(size.value).toBeCloseTo(0.52);
    } finally {
      Storage.prototype.getItem = getItem;
      Storage.prototype.setItem = setItem;
    }
  });

  it("stacks the panes below the breakpoint: no handle", () => {
    media(false);
    const { container } = mount();
    expect(screen.queryByRole("separator")).toBeNull();
    expect(container.querySelector("[data-split-pane]")!.hasAttribute("data-stacked")).toBe(true);
    expect(screen.getByText("code")).toBeTruthy();
    expect(screen.getByText("preview")).toBeTruthy();
  });
});
