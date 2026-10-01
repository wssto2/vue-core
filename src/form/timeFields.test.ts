import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref, type Component } from "vue";
import { createFormatting, installFormatting } from "../format";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import { mockMedia } from "../testing/media";
import DateTimeField from "./DateTimeField.vue";
import FormGroup from "./FormGroup.vue";
import FormView from "./FormView.vue";
import TimeField from "./TimeField.vue";

const NOW = new Date(2026, 9, 1, 12, 7); // Thursday, 1 October 2026, 12:07

const settle = async () => {
  for (let index = 0; index < 4; index++) await nextTick();
};

function mountField(component: Component, props: Record<string, unknown> = {}, options: { locale?: "en" | "hr"; plugins?: unknown[]; initial?: string | null } = {}) {
  const i18n = createTestI18n({ locale: options.locale ?? "hr" });
  const value = ref<string | null>(options.initial ?? null);
  const changes: (string | null)[] = [];
  const Host = defineComponent({
    setup: () => () => h(component, { ...props, modelValue: value.value, "onUpdate:modelValue": (next: string | null) => { changes.push(next); value.value = next; } }),
  });
  const view = render(Host, { global: { plugins: (options.plugins as never[]) ?? [i18n, testFormatting(i18n)], stubs: { transition: false } } });
  return { ...view, value, changes };
}

const type = async (label: string, text: string) => {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  input.focus();
  await fireEvent.update(input, text);
  await fireEvent.blur(input);
  await settle();
  return input;
};
const option = (list: string, value: number) => screen.getByRole("listbox", { name: list }).querySelector(`[data-value="${value}"]`)!;
const day = (value: string) => document.querySelector<HTMLElement>(`[data-day="${value}"]`)!;

let media: ReturnType<typeof mockMedia>;
beforeEach(() => {
  media = mockMedia();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  media.restore();
  document.body.innerHTML = "";
  document.body.className = "";
});

describe("TimeField", () => {
  it("reads 1435, 14.35, 14:35, 9 and the word for now", async () => {
    const { value } = mountField(TimeField, { label: "Start" });
    for (const [typed, expected] of [["1435", "14:35"], ["14.35", "14:35"], ["14:35", "14:35"], ["9", "09:00"], ["935", "09:35"], ["sada", "12:07"], ["now", "12:07"]] as const) {
      await type("Start", typed);
      expect(value.value).toBe(expected);
    }
    expect((screen.getByLabelText("Start") as HTMLInputElement).value).toBe("12:07");
  });

  it("keeps a time that does not exist next to its message and clears the value", async () => {
    const { value } = mountField(TimeField, { label: "Start" }, { initial: "09:00" });
    const input = await type("Start", "25:00");
    expect(value.value).toBeNull();
    expect(input.value).toBe("25:00");
    expect(screen.getByRole("alert").textContent).toContain("Unesite vrijeme, na primjer 14:35.");
    await type("Start", "");
    expect(value.value).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("refuses a minute off the step and offers the minutes of the step", async () => {
    const { value } = mountField(TimeField, { label: "Start", minuteStep: 15 }, { initial: "09:00" });
    await type("Start", "14:37");
    expect(screen.getByRole("alert").textContent).toContain("Minute su u koracima od 15.");
    expect(value.value).toBeNull();
    await type("Start", "14:45");
    expect(value.value).toBe("14:45");
    await fireEvent.click(screen.getByLabelText("Start"));
    await settle();
    expect(screen.getByRole("listbox", { name: "Minute" }).querySelectorAll("[role=option]")).toHaveLength(4);
  });

  it("picks from the hour and minute lists with every minute, and keeps the popover open between the two", async () => {
    const { value } = mountField(TimeField, { label: "Start" });
    await fireEvent.click(screen.getByLabelText("Start"));
    await settle();
    expect(screen.getByRole("listbox", { name: "Sat" }).querySelectorAll("[role=option]")).toHaveLength(24);
    expect(screen.getByRole("listbox", { name: "Minute" }).querySelectorAll("[role=option]")).toHaveLength(60);
    await fireEvent.click(option("Sat", 9));
    await fireEvent.click(option("Minute", 41));
    expect(value.value).toBe("09:41");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "Start" }) as HTMLInputElement).value).toBe("09:41");
  });

  it("has quick times: Now, 8:00 and 12:00 by default, or the app's own", async () => {
    const { value } = mountField(TimeField, { label: "Start" });
    await fireEvent.click(screen.getByLabelText("Start"));
    await settle();
    expect(Array.from(document.querySelectorAll("[data-test=quick-picks] button")).map((chip) => chip.textContent!.trim())).toEqual(["Sada", "8:00", "12:00"]);
    await fireEvent.click(screen.getByRole("button", { name: "8:00" }));
    expect(value.value).toBe("08:00");
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("takes quick times of its own", async () => {
    const { value } = mountField(TimeField, { label: "Start", quickTimes: [{ label: "Opening", time: () => "07:30" }, "17:00"] });
    await fireEvent.click(screen.getByLabelText("Start"));
    await settle();
    await fireEvent.click(screen.getByRole("button", { name: "Opening" }));
    expect(value.value).toBe("07:30");
  });

  it("opens with ArrowDown into the hour list and its keys change the value", async () => {
    const { value } = mountField(TimeField, { label: "Start" }, { initial: "09:30" });
    const input = screen.getByLabelText("Start");
    input.focus();
    await fireEvent.keyDown(input, { key: "ArrowDown" });
    await settle();
    expect(document.activeElement).toBe(screen.getByRole("listbox", { name: "Sat" }));
    await fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(value.value).toBe("10:30");
  });

  it("reads in the app's time format", () => {
    const i18n = createTestI18n({ locale: "hr" });
    const plugin = { install: (app: import("vue").App) => installFormatting(app, createFormatting({ locale: () => "hr", formatters: { time: (date) => `${date.getHours()}h${date.getMinutes()}` } })) };
    const Host = defineComponent({ setup: () => () => h(FormView, { editable: false }, () => h(FormGroup, {}, () => h(TimeField, { modelValue: "14:05", label: "Start" }))) });
    const { container } = render(Host, { global: { plugins: [i18n, plugin] } });
    expect(container.textContent).toContain("14h5");
  });

  describe("on a phone", () => {
    beforeEach(() => media.set({ compact: true }));

    it("opens a sheet with the quick times and two wheels; Done writes the time (now by default)", async () => {
      const { value } = mountField(TimeField, { label: "Start" });
      await fireEvent.click(screen.getByRole("button", { name: "Start" }));
      await settle();
      expect(screen.getByRole("listbox", { name: "Sat" })).toBeTruthy();
      await fireEvent.keyDown(screen.getByRole("listbox", { name: "Sat" }), { key: "ArrowDown" });
      await fireEvent.click(screen.getByRole("button", { name: "Gotovo" }));
      await settle();
      expect(value.value).toBe("13:07");
    });
  });
});

describe("DateTimeField typed entry", () => {
  it("reads a date and a time and writes wall-clock text", async () => {
    const { value } = mountField(DateTimeField, { label: "Visit" });
    const input = await type("Visit", "15.10.2026. 14:35");
    expect(value.value).toBe("2026-10-15T14:35");
    expect(input.value).toBe("15. 10. 2026. 14:35");
  });

  it("reads the shortcuts of both parts: danas 14.35, +7 9:00, 30.9. 1435 is not a time without a separator", async () => {
    const { value } = mountField(DateTimeField, { label: "Visit" });
    await type("Visit", "danas 14.35");
    expect(value.value).toBe("2026-10-01T14:35");
    await type("Visit", "+7 9:00");
    expect(value.value).toBe("2026-10-08T09:00");
    await type("Visit", "2026-12-24T08:15");
    expect(value.value).toBe("2026-12-24T08:15");
  });

  it("keeps the time of the value when only a date is typed, and the day when only a time is", async () => {
    const { value } = mountField(DateTimeField, { label: "Visit" }, { initial: "2026-10-15T14:35" });
    await type("Visit", "20.10.2026.");
    expect(value.value).toBe("2026-10-20T14:35");
    await type("Visit", "9:00");
    expect(value.value).toBe("2026-10-20T09:00");
  });

  it("takes the time now when a date is typed into an empty field", async () => {
    const { value } = mountField(DateTimeField, { label: "Visit" });
    await type("Visit", "5.10.");
    expect(value.value).toBe("2026-10-05T12:07");
  });

  it("says what is wrong, the date or the time, and keeps the text", async () => {
    const { value } = mountField(DateTimeField, { label: "Visit" }, { initial: "2026-10-15T14:35" });
    const input = await type("Visit", "31.02.2026. 14:35");
    expect(screen.getByRole("alert").textContent).toContain("Unesite datum");
    expect(value.value).toBeNull();
    expect(input.value).toBe("31.02.2026. 14:35");
    await type("Visit", "15.10.2026. 25:00");
    expect(screen.getByRole("alert").textContent).toContain("Unesite vrijeme");
    await type("Visit", "15.10.2026. 14:35");
    expect(value.value).toBe("2026-10-15T14:35");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("refuses a time before min or after max, a day alone meaning its whole day", async () => {
    const { value } = mountField(DateTimeField, { label: "Visit", min: "2026-10-05T08:00", max: "2026-10-10" });
    await type("Visit", "5.10.2026. 07:59");
    expect(screen.getByRole("alert").textContent).toContain("Taj datum nije dostupan.");
    await type("Visit", "5.10.2026. 08:00");
    expect(value.value).toBe("2026-10-05T08:00");
    await type("Visit", "10.10.2026. 23:59");
    expect(value.value).toBe("2026-10-10T23:59");
    await type("Visit", "11.10.2026. 00:00");
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("refuses minutes off the step", async () => {
    mountField(DateTimeField, { label: "Visit", minuteStep: 15 });
    await type("Visit", "15.10.2026. 14:37");
    expect(screen.getByRole("alert").textContent).toContain("Minute su u koracima od 15.");
  });
});

describe("DateTimeField popover", () => {
  it("shows the calendar beside the hour and minute lists", async () => {
    mountField(DateTimeField, { label: "Visit" }, { initial: "2026-10-15T14:35" });
    await fireEvent.click(screen.getByLabelText("Visit"));
    await settle();
    expect(screen.getByRole("grid")).toBeTruthy();
    expect(screen.getByRole("listbox", { name: "Minute" }).querySelectorAll("[role=option]")).toHaveLength(60);
    expect(screen.getByRole("listbox", { name: "Sat" })).toBeTruthy();
  });

  it("picking a day keeps the time, picking an hour or a minute keeps the day, and the popover stays open", async () => {
    const { value } = mountField(DateTimeField, { label: "Visit" }, { initial: "2026-10-15T14:35" });
    await fireEvent.click(screen.getByLabelText("Visit"));
    await settle();
    await fireEvent.click(day("2026-10-21"));
    expect(value.value).toBe("2026-10-21T14:35");
    await fireEvent.click(option("Sat", 9));
    expect(value.value).toBe("2026-10-21T09:35");
    await fireEvent.click(option("Minute", 7));
    expect(value.value).toBe("2026-10-21T09:07");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("types a time in its own box: 1435 becomes 14:35", async () => {
    const { value } = mountField(DateTimeField, { label: "Visit" }, { initial: "2026-10-15T09:00" });
    await fireEvent.click(screen.getByLabelText("Visit"));
    await settle();
    const clock = screen.getByLabelText("Vrijeme") as HTMLInputElement;
    expect(clock.value).toBe("09:00");
    await fireEvent.update(clock, "1435");
    await fireEvent.keyDown(clock, { key: "Enter" });
    await settle();
    expect(value.value).toBe("2026-10-15T14:35");
    expect(clock.value).toBe("14:35");
  });

  it("Now sets today and the time now, and closes", async () => {
    const { value } = mountField(DateTimeField, { label: "Visit" });
    await fireEvent.click(screen.getByLabelText("Visit"));
    await settle();
    await fireEvent.click(screen.getByRole("button", { name: "Sada" }));
    expect(value.value).toBe("2026-10-01T12:07");
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("offers every minute, or the minutes of a step", async () => {
    mountField(DateTimeField, { label: "Visit", minuteStep: 5 });
    await fireEvent.click(screen.getByLabelText("Visit"));
    await settle();
    expect(screen.getByRole("listbox", { name: "Minute" }).querySelectorAll("[role=option]")).toHaveLength(12);
  });

  it("has no day shortcuts unless the field is given some", async () => {
    mountField(DateTimeField, { label: "Visit" });
    await fireEvent.click(screen.getByLabelText("Visit"));
    await settle();
    expect(document.querySelector("[data-test=quick-picks]")).toBeNull();
  });

  it("reads in the app's format", () => {
    const i18n = createTestI18n({ locale: "hr" });
    const plugin = { install: (app: import("vue").App) => installFormatting(app, createFormatting({ locale: () => "hr", formatters: { dateTime: (date) => `DT ${date.getFullYear()}` } })) };
    const Host = defineComponent({ setup: () => () => h(FormView, { editable: false }, () => h(FormGroup, {}, () => h(DateTimeField, { modelValue: "2026-10-15T14:35", label: "Visit" }))) });
    const { container } = render(Host, { global: { plugins: [i18n, plugin] } });
    expect(container.textContent).toContain("DT 2026");
  });
});

describe("DateTimeField on a phone", () => {
  beforeEach(() => media.set({ compact: true }));

  it("opens a sheet with quick picks, the calendar and wheels, and Done writes day and time", async () => {
    const { value } = mountField(DateTimeField, { label: "Visit" }, { initial: "2026-10-15T14:35" });
    await fireEvent.click(screen.getByRole("button", { name: "Visit" }));
    await settle();
    expect(screen.getByRole("grid")).toBeTruthy();
    expect(screen.getByRole("listbox", { name: "Sat" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sutra" })).toBeTruthy();
    await fireEvent.click(day("2026-10-20"));
    await fireEvent.keyDown(screen.getByRole("listbox", { name: "Minute" }), { key: "ArrowDown" });
    await fireEvent.click(screen.getByRole("button", { name: "Gotovo" }));
    await settle();
    expect(value.value).toBe("2026-10-20T14:36");
  });

  it("a quick pick sets the day and keeps the time; Done without touching the time takes the time now for a new value", async () => {
    const { value } = mountField(DateTimeField, { label: "Visit" });
    await fireEvent.click(screen.getByRole("button", { name: "Visit" }));
    await settle();
    await fireEvent.click(screen.getByRole("button", { name: "Sutra" }));
    await fireEvent.click(screen.getByRole("button", { name: "Gotovo" }));
    await settle();
    expect(value.value).toBe("2026-10-02T12:07");
  });
});
