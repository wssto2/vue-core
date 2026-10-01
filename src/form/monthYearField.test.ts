import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import FormGroup from "./FormGroup.vue";
import FormView from "./FormView.vue";
import MonthYearField from "./MonthYearField.vue";

const settle = async () => {
  for (let index = 0; index < 4; index++) await nextTick();
};

function mountField(props: Record<string, unknown> = {}, initial: { month: number | null; year: number | null } = { month: null, year: null }, locale: "en" | "hr" = "en") {
  const i18n = createTestI18n({ locale });
  const month = ref(initial.month);
  const year = ref(initial.year);
  const Host = defineComponent({
    setup: () => () => h(MonthYearField, { label: "First registration", ...props, month: month.value, year: year.value, "onUpdate:month": (v: number | null) => (month.value = v), "onUpdate:year": (v: number | null) => (year.value = v) }),
  });
  render(Host, { global: { plugins: [i18n, testFormatting(i18n)] } });
  return { month, year };
}
const open = async () => {
  await fireEvent.click(screen.getByRole("button", { name: "First registration" }));
  await settle();
};
const pill = (name: string) => screen.getByRole("button", { name });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 1));
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("MonthYearField", () => {
  it("picks a month in the year shown and writes both numbers", async () => {
    const { month, year } = mountField();
    await open();
    await fireEvent.click(pill("March 2026"));
    expect([month.value, year.value]).toEqual([3, 2026]);
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("steps the year with the arrows, and stops at min and max", async () => {
    const { month, year } = mountField({ minYear: 2025, maxYear: 2027 });
    await open();
    await fireEvent.click(screen.getByRole("button", { name: "Previous year" }));
    expect((screen.getByRole("button", { name: "Previous year" }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.click(pill("June 2025"));
    expect([month.value, year.value]).toEqual([6, 2025]);
    await open();
    await fireEvent.click(screen.getByRole("button", { name: "Next year" }));
    await fireEvent.click(screen.getByRole("button", { name: "Next year" }));
    expect((screen.getByRole("button", { name: "Next year" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("opens a grid of twelve years from the year, so a far year is two clicks", async () => {
    mountField({ minYear: 1970 }, { month: 3, year: 2019 });
    await open();
    await fireEvent.click(screen.getByRole("button", { name: "Years" }));
    expect(screen.getByText("2010 – 2021")).toBeTruthy();
    expect(screen.getAllByRole("button").filter((button) => /^\d{4}$/.test(button.textContent!.trim()))).toHaveLength(12);
    expect(pill("2019").getAttribute("aria-pressed")).toBe("true");
  });

  it("shows the chosen year in the grid and goes back to the months with the year picked", async () => {
    const { month, year } = mountField({ minYear: 1970 }, { month: 3, year: 2019 });
    await open();
    await fireEvent.click(screen.getByRole("button", { name: "Years" }));
    await fireEvent.click(screen.getByRole("button", { name: "Previous years" }));
    expect(screen.getByText("1998 – 2009")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "2008" }));
    expect(screen.getByText("2008")).toBeTruthy();
    expect(year.value).toBe(2019); // nothing is written until a month is picked
    await fireEvent.click(pill("November 2008"));
    expect([month.value, year.value]).toEqual([11, 2008]);
  });

  it("does not offer years outside min and max", async () => {
    mountField({ minYear: 2015, maxYear: 2024 }, { month: 3, year: 2019 });
    await open();
    await fireEvent.click(screen.getByRole("button", { name: "Years" }));
    expect((screen.getByRole("button", { name: "2014" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "2015" }) as HTMLButtonElement).disabled).toBe(false);
    await fireEvent.click(screen.getByRole("button", { name: "Next years" }));
    expect((screen.getByRole("button", { name: "2024" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "2025" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("marks the chosen month in its year", async () => {
    mountField({}, { month: 3, year: 2019 });
    await open();
    expect(pill("March 2019").getAttribute("aria-pressed")).toBe("true");
    expect(pill("April 2019").getAttribute("aria-pressed")).toBe("false");
  });

  it("clears both", async () => {
    const { month, year } = mountField({}, { month: 3, year: 2019 });
    await open();
    await fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect([month.value, year.value]).toEqual([null, null]);
  });

  it("shows a month and year in the market's own language", () => {
    mountField({ label: "Prva registracija" }, { month: 3, year: 2021 }, "hr");
    expect(screen.getByRole("button", { name: "Prva registracija" }).textContent).toContain("ožujak 2021.");
  });

  it("reads as text in a read-only form", () => {
    const i18n = createTestI18n();
    const Host = defineComponent({ setup: () => () => h(FormView, { editable: false }, () => h(FormGroup, {}, () => h(MonthYearField, { month: 3, year: 2021, label: "First registration" }))) });
    const { container } = render(Host, { global: { plugins: [i18n, testFormatting(i18n)] } });
    expect(container.textContent).toContain("March 2021");
  });
});
