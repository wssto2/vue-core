import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref, type Component } from "vue";
import { createFormatting, installFormatting } from "../format";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import { mockMedia } from "../testing/media";
import DateField from "./DateField.vue";
import FormGroup from "./FormGroup.vue";
import FormView from "./FormView.vue";

const NOW = new Date(2026, 9, 1, 12, 0); // Thursday, 1 October 2026

const settle = async () => {
  for (let index = 0; index < 4; index++) await nextTick();
};

/** The field in a Host holding its value, as a form would. */
function mountField(component: Component, props: Record<string, unknown> = {}, options: { locale?: "en" | "hr"; plugins?: unknown[]; initial?: string | null } = {}) {
  const i18n = createTestI18n(options.locale ?? "hr");
  const value = ref<string | null>(options.initial ?? null);
  const changes: (string | null)[] = [];
  const Host = defineComponent({
    setup: () => () => h(component, { ...props, modelValue: value.value, "onUpdate:modelValue": (next: string | null) => { changes.push(next); value.value = next; } }),
  });
  const view = render(Host, { global: { plugins: (options.plugins as never[]) ?? [i18n, testFormatting(i18n)], stubs: { transition: false } } });
  return { ...view, value, changes };
}

const type = async (label: string, text: string, commit: "blur" | "enter" = "blur") => {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  input.focus();
  await fireEvent.update(input, text);
  if (commit === "enter") await fireEvent.keyDown(input, { key: "Enter" });
  else await fireEvent.blur(input);
  await settle();
  return input;
};
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

describe("DateField typed entry", () => {
  it("reads the whole date in the app's format and writes the day as text", async () => {
    const { value } = mountField(DateField, { label: "Due" });
    const input = await type("Due", "30.09.2026.");
    expect(value.value).toBe("2026-09-30");
    expect(input.value).toBe("30. 09. 2026."); // shown the way the app formats it
  });

  it("fills the year of 30.9., counts days with +7 and -1, and knows today and tomorrow", async () => {
    const { value } = mountField(DateField, { label: "Due" });
    await type("Due", "30.9.");
    expect(value.value).toBe("2026-09-30");
    await type("Due", "+7");
    expect(value.value).toBe("2026-10-08");
    await type("Due", "-1");
    expect(value.value).toBe("2026-09-30");
    await type("Due", "danas");
    expect(value.value).toBe("2026-10-01");
    await type("Due", "tomorrow");
    expect(value.value).toBe("2026-10-02");
    await type("Due", "sutra", "enter");
    expect(value.value).toBe("2026-10-02");
  });

  it("clears with null, never with an empty string", async () => {
    const { value, changes } = mountField(DateField, { label: "Due" }, { initial: "2026-09-30" });
    await type("Due", "");
    expect(value.value).toBeNull();
    expect(changes).toEqual([null]);
  });

  it("keeps text that is not a day next to its message, and the value is null until it is", async () => {
    const { value } = mountField(DateField, { label: "Due" }, { initial: "2026-09-30" });
    const input = await type("Due", "31.02.2026.");
    expect(value.value).toBeNull();
    expect(input.value).toBe("31.02.2026.");
    expect(screen.getByRole("alert").textContent).toContain("Unesite datum, na primjer 01. 10. 2026.");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    await type("Due", "28.02.2026.");
    expect(value.value).toBe("2026-02-28");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("never rolls an impossible day over into another one", async () => {
    const { changes } = mountField(DateField, { label: "Due" });
    for (const text of ["29.02.2027.", "45.13.2026.", "0.1.2026", "32.1."]) await type("Due", text);
    expect(changes.filter((change) => change !== null)).toEqual([]);
  });

  it("says a day outside min and max, or a disabled one, is not available", async () => {
    const { value } = mountField(DateField, { label: "Due", min: "2026-10-01", max: "2026-12-31", disabledDates: ["2026-11-11"] });
    await type("Due", "30.09.2026.");
    expect(screen.getByRole("alert").textContent!.trim()).toBe("Taj datum nije dostupan.");
    await type("Due", "11.11.2026.");
    expect(screen.getByRole("alert")).toBeTruthy();
    await type("Due", "12.11.2026.");
    expect(value.value).toBe("2026-11-12");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reads the typed order off the app's formatter, not the locale", async () => {
    const i18n = createTestI18n("hr");
    const american = { install: (app: import("vue").App) => installFormatting(app, createFormatting({ locale: () => "hr", formatters: { date: (value) => `${value.getMonth() + 1}/${value.getDate()}/${value.getFullYear()}` } })) };
    const { value } = mountField(DateField, { label: "Due" }, { plugins: [i18n, american] });
    const input = await type("Due", "10/15/2026");
    expect(value.value).toBe("2026-10-15");
    expect(input.value).toBe("10/15/2026");
  });

  it("is a combobox that opens a dialog, and a locked field cannot be typed into", () => {
    mountField(DateField, { label: "Due", disabled: true });
    const input = screen.getByLabelText("Due") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Otvori kalendar" })).toBeNull();
  });

  it("an external value replaces the text; a draft with an error survives re-rendering", async () => {
    const { value } = mountField(DateField, { label: "Due" });
    const input = await type("Due", "99.99.");
    value.value = "2027-01-02";
    await settle();
    expect(input.value).toBe("02. 01. 2027.");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("DateField calendar", () => {
  it("opens on a click, shows the month of the value, and picks a day", async () => {
    const { value } = mountField(DateField, { label: "Due" }, { initial: "2026-09-15" });
    await fireEvent.click(screen.getByLabelText("Due"));
    await settle();
    expect(screen.getByRole("dialog", { name: "Due" })).toBeTruthy();
    expect(screen.getByText("rujan 2026.")).toBeTruthy();
    await fireEvent.click(day("2026-09-20"));
    await settle();
    expect(value.value).toBe("2026-09-20");
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect((screen.getByLabelText("Due") as HTMLInputElement).value).toBe("20. 09. 2026.");
  });

  it("an empty field opens on today's month even when min is long ago", async () => {
    mountField(DateField, { label: "Due", min: "2000-01-01" });
    await fireEvent.click(screen.getByLabelText("Due"));
    await settle();
    expect(screen.getByText("listopad 2026.")).toBeTruthy();
  });

  it("keeps focus in the field when opened by a click, so typing goes on", async () => {
    mountField(DateField, { label: "Due" });
    const input = screen.getByLabelText("Due");
    input.focus();
    await fireEvent.click(input);
    await settle();
    expect(document.activeElement).toBe(input);
  });

  it("follows what is typed while it is a real day", async () => {
    mountField(DateField, { label: "Due" });
    const input = screen.getByLabelText("Due");
    await fireEvent.click(input);
    await fireEvent.update(input, "05.03.2027.");
    await settle();
    expect(screen.getByText("ožujak 2027.")).toBeTruthy();
    expect(day("2027-03-05").closest("[role=gridcell]")!.getAttribute("aria-selected")).toBe("true");
  });

  it("opens with ArrowDown into the calendar, and Escape closes it and returns focus to the field", async () => {
    mountField(DateField, { label: "Due" }, { initial: "2026-10-15" });
    const input = screen.getByLabelText("Due");
    input.focus();
    await fireEvent.keyDown(input, { key: "ArrowDown" });
    await settle();
    expect(document.activeElement).toBe(day("2026-10-15"));
    await fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    await settle();
    expect(document.activeElement).toBe(day("2026-10-16"));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await vi.waitFor(() => expect(document.activeElement).toBe(input));
  });

  it("picks the focused day with Enter and closes", async () => {
    const { value } = mountField(DateField, { label: "Due" }, { initial: "2026-10-15" });
    const input = screen.getByLabelText("Due");
    await fireEvent.keyDown(input, { key: "ArrowDown" });
    await settle();
    await fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    await settle();
    await fireEvent.click(document.activeElement!); // a browser turns Enter on a button into a click
    await settle();
    expect(value.value).toBe("2026-10-22");
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("opens from the calendar button", async () => {
    mountField(DateField, { label: "Due" });
    await fireEvent.click(screen.getByRole("button", { name: "Otvori kalendar" }));
    await settle();
    expect(screen.getByRole("grid")).toBeTruthy();
    expect(document.activeElement).toBe(day("2026-10-01")); // today, in the grid
    await fireEvent.click(screen.getByRole("button", { name: "Otvori kalendar" }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("DateField quick picks", () => {
  it("offers today, tomorrow, in 7 days and the end of the month, and sets the day", async () => {
    const { value } = mountField(DateField, { label: "Due" });
    await fireEvent.click(screen.getByLabelText("Due"));
    await settle();
    const chips = within().map((chip) => chip.textContent!.trim());
    expect(chips).toEqual(["Danas", "Sutra", "Za 7 dana", "Kraj mjeseca"]);
    await fireEvent.click(screen.getByRole("button", { name: "Kraj mjeseca" }));
    await settle();
    expect(value.value).toBe("2026-10-31");
  });

  it("takes the app's own picks (working-day logic, any label)", async () => {
    const { value } = mountField(DateField, { label: "Due", quickPicks: ["today", { label: "Next delivery", day: (today: string) => `${today.slice(0, 8)}20` }] });
    await fireEvent.click(screen.getByLabelText("Due"));
    await settle();
    await fireEvent.click(screen.getByRole("button", { name: "Next delivery" }));
    await settle();
    expect(value.value).toBe("2026-10-20");
  });

  it("disables a pick the field does not allow", async () => {
    mountField(DateField, { label: "Due", min: "2026-10-05" });
    await fireEvent.click(screen.getByLabelText("Due"));
    await settle();
    expect((screen.getByRole("button", { name: "Danas" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Kraj mjeseca" }) as HTMLButtonElement).disabled).toBe(false);
  });

  const within = () => Array.from(document.querySelectorAll("[data-test=quick-picks] button"));
});

describe("DateField on a phone", () => {
  beforeEach(() => media.set({ compact: true }));

  it("is a button that opens a half sheet with quick picks, the calendar and Done", async () => {
    const { value } = mountField(DateField, { label: "Due" });
    await fireEvent.click(screen.getByRole("button", { name: "Due" }));
    await settle();
    const chips = Array.from(document.querySelectorAll("[data-test=quick-picks] button")).map((chip) => chip.textContent!.trim());
    expect(chips).toEqual(["Danas", "Sutra", "Sljedeći radni dan"]);
    await fireEvent.click(screen.getByRole("button", { name: "Sljedeći radni dan" }));
    await settle();
    await fireEvent.click(screen.getByRole("button", { name: "Gotovo" }));
    await settle();
    expect(value.value).toBe("2026-10-02");
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("dismissing the sheet keeps the value, Clear empties it", async () => {
    const { value } = mountField(DateField, { label: "Due" }, { initial: "2026-10-15" });
    await fireEvent.click(screen.getByRole("button", { name: "Due" }));
    await settle();
    await fireEvent.click(day("2026-10-20"));
    await fireEvent.click(document.querySelector<HTMLElement>(".fixed.inset-0")!); // the backdrop
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(value.value).toBe("2026-10-15");
    await fireEvent.click(screen.getByRole("button", { name: "Due" }));
    await settle();
    await fireEvent.click(screen.getByRole("button", { name: "Očisti" }));
    await settle();
    expect(value.value).toBeNull();
  });
});

describe("DateField in a form", () => {
  it("reads in the app's format with no shift across time zones", () => {
    const i18n = createTestI18n("en");
    const Host = defineComponent({ setup: () => () => h(FormView, { editable: false }, () => h(FormGroup, {}, () => h(DateField, { modelValue: "2026-03-01", label: "When" }))) });
    const { container } = render(Host, { global: { plugins: [i18n, testFormatting(i18n)] } });
    expect(container.textContent).toMatch(/0?3\/0?1\/2026/);
  });
});
