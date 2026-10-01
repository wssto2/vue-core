import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestI18n } from "../../testing/i18n";
import { mockMedia } from "../../testing/media";
import TimeColumns from "./TimeColumns.vue";

function mount(props: Record<string, unknown> = {}) {
  const update = vi.fn();
  const view = render(TimeColumns, { props: { ...props, "onUpdate:modelValue": update }, global: { plugins: [createTestI18n("en")] } });
  return { ...view, update };
}
const options = (label: string) => Array.from(screen.getByRole("listbox", { name: label }).querySelectorAll("[role=option]")).map((option) => option.textContent!.trim());

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("TimeColumns as lists", () => {
  it("offers the hours 00 to 23 and every minute 00 to 59", () => {
    mount({ modelValue: "14:35" });
    expect(options("Hour")).toHaveLength(24);
    expect(options("Hour")[0]).toBe("00");
    expect(options("Hour")[23]).toBe("23");
    expect(options("Minute")).toHaveLength(60);
    expect(options("Minute")[59]).toBe("59");
  });

  it("marks the chosen hour and minute", () => {
    mount({ modelValue: "14:35" });
    const selected = (label: string) => Array.from(screen.getByRole("listbox", { name: label }).querySelectorAll("[aria-selected=true]")).map((option) => option.textContent!.trim());
    expect(selected("Hour")).toEqual(["14"]);
    expect(selected("Minute")).toEqual(["35"]);
  });

  it("picks an hour with a click and keeps the minute", async () => {
    const { update } = mount({ modelValue: "14:35" });
    await fireEvent.click(screen.getByRole("listbox", { name: "Hour" }).querySelector('[data-value="9"]')!);
    expect(update).toHaveBeenLastCalledWith("09:35");
    await fireEvent.click(screen.getByRole("listbox", { name: "Minute" }).querySelector('[data-value="7"]')!);
    expect(update).toHaveBeenLastCalledWith("14:07");
  });

  it("starts from 00 for the part that is not chosen yet", async () => {
    const { update } = mount({ modelValue: null });
    await fireEvent.click(screen.getByRole("listbox", { name: "Minute" }).querySelector('[data-value="30"]')!);
    expect(update).toHaveBeenLastCalledWith("00:30");
  });

  it("changes with the arrow keys, Home, End and the Page keys", async () => {
    const { update } = mount({ modelValue: "14:35" });
    const hours = screen.getByRole("listbox", { name: "Hour" });
    await fireEvent.keyDown(hours, { key: "ArrowDown" });
    expect(update).toHaveBeenLastCalledWith("15:35");
    await fireEvent.keyDown(hours, { key: "ArrowUp" });
    expect(update).toHaveBeenLastCalledWith("13:35");
    await fireEvent.keyDown(hours, { key: "Home" });
    expect(update).toHaveBeenLastCalledWith("00:35");
    await fireEvent.keyDown(hours, { key: "End" });
    expect(update).toHaveBeenLastCalledWith("23:35");
    await fireEvent.keyDown(hours, { key: "PageUp" });
    expect(update).toHaveBeenLastCalledWith("09:35");
    const minutes = screen.getByRole("listbox", { name: "Minute" });
    await fireEvent.keyDown(minutes, { key: "ArrowDown" });
    expect(update).toHaveBeenLastCalledWith("14:36");
  });

  it("offers the minutes of a step only", async () => {
    const { update } = mount({ modelValue: "14:35", step: 5 });
    expect(options("Minute")).toEqual(["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"]);
    await fireEvent.keyDown(screen.getByRole("listbox", { name: "Minute" }), { key: "ArrowDown" });
    expect(update).toHaveBeenLastCalledWith("14:40");
  });

  it("does not move past the first and last number", async () => {
    const { update } = mount({ modelValue: "23:59" });
    await fireEvent.keyDown(screen.getByRole("listbox", { name: "Hour" }), { key: "ArrowDown" });
    await fireEvent.keyDown(screen.getByRole("listbox", { name: "Minute" }), { key: "ArrowDown" });
    expect(update).not.toHaveBeenCalled();
  });
});

describe("TimeColumns as wheels", () => {
  let media: ReturnType<typeof mockMedia>;
  beforeEach(() => {
    media = mockMedia({ compact: true });
    vi.useFakeTimers();
  });
  afterEach(() => media.restore());

  const spin = async (label: string, top: number) => {
    const wheel = screen.getByRole("listbox", { name: label });
    wheel.scrollTop = top;
    await fireEvent.scroll(wheel);
    vi.advanceTimersByTime(100);
  };

  it("takes the number in the middle as the value when the wheel stops (30 px a number)", async () => {
    const { update } = mount({ modelValue: "14:35", variant: "wheel" });
    await spin("Hour", 16 * 30);
    expect(update).toHaveBeenLastCalledWith("16:35");
    await spin("Minute", 12 * 30 + 8); // between 12 and 13: the nearer
    expect(update).toHaveBeenLastCalledWith("14:12");
  });

  it("does not report a value while the wheel is still turning", async () => {
    const { update } = mount({ modelValue: "14:35", variant: "wheel" });
    const wheel = screen.getByRole("listbox", { name: "Hour" });
    wheel.scrollTop = 15 * 30;
    await fireEvent.scroll(wheel);
    vi.advanceTimersByTime(40);
    wheel.scrollTop = 17 * 30;
    await fireEvent.scroll(wheel);
    vi.advanceTimersByTime(40);
    expect(update).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenLastCalledWith("17:35");
  });

  it("is a listbox the keyboard turns", async () => {
    const { update } = mount({ modelValue: "14:35", variant: "wheel" });
    await fireEvent.keyDown(screen.getByRole("listbox", { name: "Minute" }), { key: "ArrowDown" });
    expect(update).toHaveBeenLastCalledWith("14:36");
    expect(screen.getByRole("listbox", { name: "Minute" }).getAttribute("aria-activedescendant")).toMatch(/-35$/);
  });

  it("snaps to its numbers in the browser (the drum is a scroll-snap container)", () => {
    mount({ modelValue: "14:35", variant: "wheel" });
    const wheel = screen.getByRole("listbox", { name: "Hour" });
    expect(wheel.className).toContain("snap-y");
    expect(wheel.querySelector('[data-value="14"]')!.className).toContain("snap-center");
  });

  it("scrolls to the new value without animation when the user prefers reduced motion", async () => {
    media.set({ reducedMotion: true });
    const view = mount({ modelValue: "14:35", variant: "wheel" });
    const wheel = screen.getByRole("listbox", { name: "Hour" });
    const scrollTo = vi.fn();
    wheel.scrollTo = scrollTo as unknown as typeof wheel.scrollTo;
    await view.rerender({ modelValue: "20:35", variant: "wheel" });
    expect(scrollTo).toHaveBeenCalledWith({ top: 600, behavior: "instant" });
  });
});
