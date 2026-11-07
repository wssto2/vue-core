import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { createTestI18n } from "../testing/i18n";
import PreviewFrame from "./PreviewFrame.vue";
import { PREVIEW_WIDTHS, parsePreviewAction, previewScale, type PreviewAction, type PreviewCommand } from "./previewFrame";

const global = { plugins: [createTestI18n()] };
const SRC = "https://site.example/preview/1";

type Handle = { reload: () => void; post: (message: PreviewCommand) => void };
function mount(props: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  const frame = ref<Handle | null>(null);
  const device = ref<"desktop" | "tablet" | "mobile">("desktop");
  const Host = defineComponent({ setup: () => () => h(PreviewFrame, { ref: frame, src: SRC, title: "Preview", device: device.value, "onUpdate:device": (next: typeof device.value) => (device.value = next), ...props, ...extra }) });
  return { ...render(Host, { global }), frame, device };
}
const iframe = () => document.querySelector("iframe")!;
const send = (data: unknown, origin = "https://site.example", source: unknown = iframe().contentWindow) =>
  window.dispatchEvent(new MessageEvent("message", { data, origin, source: source as MessageEventSource | null }));

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("previewScale", () => {
  it("scales a wide page down to the pane, never up, and not at all before the pane is measured", () => {
    expect(previewScale(640, 1280)).toBe(0.5);
    expect(previewScale(2000, 1280)).toBe(1);
    expect(previewScale(0, 1280)).toBe(1);
    expect(previewScale(300, 375)).toBeCloseTo(0.8);
  });

  it("has the three presets", () => {
    expect(PREVIEW_WIDTHS).toEqual({ desktop: 1280, tablet: 768, mobile: 375 });
  });
});

describe("PreviewFrame", () => {
  it("is a titled, sandboxed iframe of the page, at the preset width", () => {
    mount();
    expect(iframe().getAttribute("src")).toBe(SRC);
    expect(iframe().getAttribute("title")).toBe("Preview");
    expect(iframe().getAttribute("sandbox")).toBe("allow-scripts allow-same-origin allow-forms");
    expect(iframe().style.width).toBe("1280px");
  });

  it("switches the width with the device presets", async () => {
    const { device } = mount();
    await fireEvent.click(screen.getByRole("tab", { name: "Mobile" }));
    expect(device.value).toBe("mobile");
    await nextTick();
    expect(iframe().style.width).toBe("375px");
    expect(screen.getByText("Width 375 px")).toBeTruthy();
  });

  it("shows loading, then the load time; and an error with Retry when the page never loads", async () => {
    vi.useFakeTimers();
    const loads: number[] = [];
    let errors = 0;
    mount({ timeout: 1000 }, { onLoad: (ms: number) => loads.push(ms), onError: () => errors++ });
    expect(document.querySelector("[data-preview-loading]")).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(errors).toBe(1);
    expect(screen.getByRole("alert").textContent).toContain("could not be loaded");

    await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(document.querySelector("[data-preview-failed]")).toBeNull();
    await fireEvent.load(iframe());
    expect(document.querySelector("[data-preview-loading]")).toBeNull();
    expect(loads).toHaveLength(1);
    expect(screen.getByText(/ ms$/)).toBeTruthy();
  });

  it("reload mounts a fresh iframe", async () => {
    const { frame } = mount();
    const before = iframe();
    frame.value!.reload();
    await nextTick();
    expect(iframe()).not.toBe(before);
    await fireEvent.click(screen.getByRole("button", { name: "Reload preview" }));
    await nextTick();
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
  });

  it("passes on the page's actions from its own origin", () => {
    const got: PreviewAction[] = [];
    mount({}, { onMessage: (message: PreviewAction) => got.push(message) });
    expect(iframe().contentWindow).not.toBeNull();
    send({ type: "edit", id: "c1" });
    send({ type: "reorder", id: "c1", to: 2 });
    send({ type: "add" });
    expect(got).toEqual([{ type: "edit", id: "c1" }, { type: "reorder", id: "c1", to: 2 }, { type: "add" }]);
  });

  it("ignores messages from a foreign origin, from another window, and ones it does not know", () => {
    const got: unknown[] = [];
    mount({}, { onMessage: (message: unknown) => got.push(message) });
    send({ type: "delete", id: "c1" }, "https://evil.example");
    send({ type: "delete", id: "c1" }, "https://site.example", window);
    send({ type: "delete", id: "c1" }, "https://site.example", null);
    send({ type: "format-disk" });
    send({ type: "edit" }); // no id
    send("edit");
    expect(got).toEqual([]);
  });

  it("takes the origin from the prop when given", () => {
    const got: unknown[] = [];
    mount({ origin: "https://cdn.example" }, { onMessage: (message: unknown) => got.push(message) });
    send({ type: "edit", id: "x" });
    send({ type: "edit", id: "x" }, "https://cdn.example");
    expect(got).toEqual([{ type: "edit", id: "x" }]);
  });

  it("posts to the page only for its origin", () => {
    const { frame } = mount();
    const post = vi.fn();
    Object.defineProperty(iframe(), "contentWindow", { value: { postMessage: post } });
    frame.value!.post({ type: "select", id: "c2" });
    expect(post).toHaveBeenCalledWith({ type: "select", id: "c2" }, "https://site.example");
  });

  it("stops listening when it unmounts", () => {
    const got: unknown[] = [];
    const { unmount } = mount({}, { onMessage: (message: unknown) => got.push(message) });
    const target = iframe().contentWindow;
    unmount();
    window.dispatchEvent(new MessageEvent("message", { data: { type: "edit", id: "a" }, origin: "https://site.example", source: target as MessageEventSource }));
    expect(got).toEqual([]);
  });
});

describe("parsePreviewAction", () => {
  it("accepts the six actions with their fields and nothing else", () => {
    expect(parsePreviewAction({ type: "copy-locale", id: "c", from: "en" })).toEqual({ type: "copy-locale", id: "c", from: "en" });
    expect(parsePreviewAction({ type: "duplicate", id: "c", extra: 1 })).toEqual({ type: "duplicate", id: "c" });
    expect(parsePreviewAction({ type: "add", after: "c" })).toEqual({ type: "add", after: "c" });
    expect(parsePreviewAction({ type: "reorder", id: "c", to: "2" })).toBeNull();
    expect(parsePreviewAction({ type: "nope" })).toBeNull();
    expect(parsePreviewAction(null)).toBeNull();
  });
});
