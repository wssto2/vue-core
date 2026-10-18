import { fireEvent, render, screen, waitFor } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { toast } from "../overlay";
import { createTestApp, createTestPlatform, jsonResponse, routedTransport, settle } from "../testing";
import Tip from "./Tip.vue";

const anchors: HTMLElement[] = [];
const anchor = (name = "search") => {
  const element = document.createElement("button");
  element.dataset.test = name;
  element.textContent = name;
  document.body.append(element);
  anchors.push(element);
  return element;
};
afterEach(() => {
  anchors.splice(0).forEach((element) => element.remove());
  vi.restoreAllMocks();
});

const saved = (preferences: object) => jsonResponse(200, { success: true, data: { preferences } });
const sent = (calls: { init: RequestInit }[]) => calls.map((call) => JSON.parse(String(call.init.body)));

function show(props: Record<string, unknown>, { preferences = {}, answer = saved({}) }: { preferences?: Record<string, unknown>; answer?: Response } = {}) {
  const { transport, calls } = routedTransport({ "PUT /v1/auth/preferences": answer });
  const app = createTestApp({ platform: createTestPlatform({ transport, preferences }) });
  const view = render(Tip, { props: { id: "search", anchor: "[data-test=search]", title: "Quick search", text: "Find anything.", ...props }, global: { plugins: [...app.plugins] } });
  return { calls, ...view };
}

describe("Tip", () => {
  it("points at the anchor with its title and text, as a labelled dialog", async () => {
    const target = anchor();
    show({});
    const tip = await screen.findByRole("dialog", { name: "Quick search" });
    expect(tip.textContent).toContain("Find anything.");
    expect(target.hasAttribute("data-tip-anchor")).toBe(true);
  });

  it("is closed for good by the button: saved as a dismissed id, and the anchor is released", async () => {
    const target = anchor();
    const { calls } = show({}, { answer: saved({ tips_dismissed: ["search"] }) });
    await fireEvent.click(await screen.findByRole("button", { name: "Got it" }));
    await settle();
    expect(sent(calls)).toEqual([{ preferences: { tips_dismissed: ["search"] } }]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(target.hasAttribute("data-tip-anchor")).toBe(false);
  });

  it("keeps the others already closed, at the path the app chose", async () => {
    anchor();
    const { calls } = show({ dismissedAt: ["onboarding", "tips_dismissed"] }, { preferences: { onboarding: { welcome_done: true, tips_dismissed: ["x"] } }, answer: saved({}) });
    await fireEvent.click(await screen.findByRole("button", { name: "Got it" }));
    await settle();
    expect(sent(calls)).toEqual([{ preferences: { onboarding: { tips_dismissed: ["x", "search"] } } }]);
  });

  it("is closed by Escape", async () => {
    anchor();
    show({}, { answer: saved({ tips_dismissed: ["search"] }) });
    await fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape" });
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is closed by the close button", async () => {
    anchor();
    show({}, { answer: saved({ tips_dismissed: ["search"] }) });
    await fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is not shown once dismissed, while not ready, or without its anchor", async () => {
    anchor();
    show({}, { preferences: { tips_dismissed: ["search"] } });
    show({ id: "later", ready: false });
    show({ id: "elsewhere", anchor: "[data-test=missing]" });
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows when it becomes ready, and when its anchor appears late", async () => {
    const ready = ref(false);
    const { transport } = routedTransport({});
    const app = createTestApp({ platform: createTestPlatform({ transport }) });
    render(defineComponent({ render: () => h(Tip, { id: "late", anchor: "[data-test=late]", title: "Late", ready: ready.value }) }), { global: { plugins: [...app.plugins] } });
    ready.value = true;
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    anchor("late");
    expect((await screen.findByRole("dialog", { name: "Late" })).tagName).toBe("DIV");
  });

  it("shows one at a time: the next waiting tip takes over when the first closes", async () => {
    anchor("one");
    anchor("two");
    const { transport } = routedTransport({ "PUT /v1/auth/preferences": saved({}) });
    const app = createTestApp({ platform: createTestPlatform({ transport }) });
    render(defineComponent({ render: () => [h(Tip, { id: "one", anchor: "[data-test=one]", title: "First" }), h(Tip, { id: "two", anchor: "[data-test=two]", title: "Second" })] }), { global: { plugins: [...app.plugins] } });
    expect(await screen.findAllByRole("dialog")).toHaveLength(1);
    const first = screen.getByRole("dialog").getAttribute("aria-label")!;
    await fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    await waitFor(() => expect(screen.getByRole("dialog").getAttribute("aria-label")).not.toBe(first));
  });

  it("moves focus to its button when nothing has focus", async () => {
    anchor();
    show({});
    const ok = await screen.findByRole("button", { name: "Got it" });
    await waitFor(() => expect(document.activeElement).toBe(ok));
  });

  it("comes back with a toast when the save is refused", async () => {
    const error = vi.spyOn(toast, "error");
    anchor();
    show({}, { answer: jsonResponse(500, { success: false, error: "boom" }) });
    await fireEvent.click(await screen.findByRole("button", { name: "Got it" }));
    await waitFor(() => expect(error).toHaveBeenCalledOnce());
    expect(await screen.findByRole("dialog", { name: "Quick search" })).toBeTruthy();
  });
});
