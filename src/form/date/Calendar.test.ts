import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { testFormatting } from "../../testing/format";
import { createTestI18n } from "../../testing/i18n";
import Calendar from "./Calendar.vue";

const NOW = new Date(2026, 9, 15, 12, 0); // Thursday, 15 October 2026

function mount(props: Record<string, unknown> = {}, locale: "en" | "hr" = "hr") {
  const i18n = createTestI18n(locale);
  const update = vi.fn();
  const view = render(Calendar, { props: { ...props, "onUpdate:modelValue": update }, global: { plugins: [i18n, testFormatting(i18n)] } });
  return { ...view, update };
}
const day = (value: string) => document.querySelector<HTMLElement>(`[data-day="${value}"]`)!;
const keys = async (target: HTMLElement, ...names: string[]) => {
  for (const key of names) await fireEvent.keyDown(target, { key });
  await nextTick();
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("Calendar", () => {
  it("is a labelled grid of the month, Monday first in hr, with a live month title", () => {
    mount({ modelValue: "2026-10-20" });
    expect(screen.getByRole("grid").getAttribute("aria-labelledby")).toBeTruthy();
    expect(screen.getByText("listopad 2026.").getAttribute("aria-live")).toBe("polite");
    const headers = screen.getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers).toEqual(["Po", "Ut", "Sr", "Če", "Pe", "Su", "Ne"]);
    expect(screen.getAllByRole("row")).toHaveLength(6); // the header row and five weeks
  });

  it("starts the week on Sunday where the locale does", () => {
    const i18n = createTestI18n("en");
    render(Calendar, { props: { modelValue: null }, global: { plugins: [i18n, testFormatting(i18n)] } });
    expect(screen.getAllByRole("columnheader")[0]!.textContent).toBe("Su");
  });

  it("marks the selected day, today, and the weekend", () => {
    mount({ modelValue: "2026-10-20" });
    expect(day("2026-10-20").closest("[role=gridcell]")!.getAttribute("aria-selected")).toBe("true");
    expect(day("2026-10-21").closest("[role=gridcell]")!.getAttribute("aria-selected")).toBe("false");
    expect(day("2026-10-15").getAttribute("aria-current")).toBe("date");
    expect(day("2026-10-20").getAttribute("aria-label")).toMatch(/utorak, 20. listopada 2026./);
  });

  it("opens an empty calendar on today's month, not on min's", () => {
    mount({ modelValue: null, min: "2000-01-01" });
    expect(screen.getByText("listopad 2026.")).toBeTruthy();
    expect(day("2026-10-15").tabIndex).toBe(0);
  });

  it("opens an empty calendar inside its range, and on openOn when given", () => {
    mount({ modelValue: null, min: "2027-02-10" });
    expect(screen.getByText("veljača 2027.")).toBeTruthy();
    document.body.innerHTML = "";
    mount({ modelValue: null, openOn: "2025-03-01" });
    expect(screen.getByText("ožujak 2025.")).toBeTruthy();
  });

  it("picks a day with a click, and a day of the next month shown in the grid", async () => {
    const { update } = mount({ modelValue: "2026-10-20" });
    await fireEvent.click(day("2026-10-22"));
    expect(update).toHaveBeenLastCalledWith("2026-10-22");
    await fireEvent.click(day("2026-11-01"));
    expect(update).toHaveBeenLastCalledWith("2026-11-01");
  });

  it("does not pick a day outside min and max or a disabled one", async () => {
    const { update } = mount({ modelValue: null, min: "2026-10-10", max: "2026-10-25", disabledDates: ["2026-10-20"] });
    for (const value of ["2026-10-09", "2026-10-26", "2026-10-20"]) {
      expect(day(value).getAttribute("aria-disabled")).toBe("true");
      await fireEvent.click(day(value));
    }
    expect(update).not.toHaveBeenCalled();
    await fireEvent.click(day("2026-10-21"));
    expect(update).toHaveBeenCalledWith("2026-10-21");
  });

  it("goes by month with the arrows, and not past min and max", async () => {
    mount({ modelValue: "2026-10-20", min: "2026-09-15", max: "2026-11-30" });
    await fireEvent.click(screen.getByRole("button", { name: "Sljedeći mjesec" }));
    expect(screen.getByText("studeni 2026.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Sljedeći mjesec" }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.click(screen.getByRole("button", { name: "Prethodni mjesec" }));
    await fireEvent.click(screen.getByRole("button", { name: "Prethodni mjesec" }));
    expect(screen.getByText("rujan 2026.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Prethodni mjesec" }) as HTMLButtonElement).disabled).toBe(true);
  });

  describe("keyboard", () => {
    it("has one day in the tab order, the selected one", () => {
      mount({ modelValue: "2026-10-20" });
      expect(document.querySelectorAll('[data-day][tabindex="0"]')).toHaveLength(1);
      expect(day("2026-10-20").tabIndex).toBe(0);
    });

    it("moves by day, week, month and year, and focuses the new day", async () => {
      mount({ modelValue: "2026-10-20" });
      const grid = screen.getByRole("grid");
      day("2026-10-20").focus();
      await keys(grid, "ArrowRight");
      expect(document.activeElement).toBe(day("2026-10-21"));
      await keys(grid, "ArrowDown");
      expect(document.activeElement).toBe(day("2026-10-28"));
      await keys(grid, "ArrowDown", "ArrowDown"); // into November
      expect(screen.getByText("studeni 2026.")).toBeTruthy();
      expect(document.activeElement).toBe(day("2026-11-11"));
      await keys(grid, "PageUp");
      expect(document.activeElement).toBe(day("2026-10-11"));
      await keys(grid, "PageDown");
      await keys(grid, "ArrowLeft", "Home");
      expect(document.activeElement).toBe(day("2026-11-09")); // Monday of that week
      await keys(grid, "End");
      expect(document.activeElement).toBe(day("2026-11-15"));
      await fireEvent.keyDown(grid, { key: "PageDown", shiftKey: true });
      await nextTick();
      expect(screen.getByText("studeni 2027.")).toBeTruthy();
    });

    it("does not leave min and max, and does not pick on arrows", async () => {
      const { update } = mount({ modelValue: "2026-10-12", min: "2026-10-10" });
      const grid = screen.getByRole("grid");
      day("2026-10-12").focus();
      await keys(grid, "ArrowUp"); // 5 October is below min: stops at the min
      expect(document.activeElement).toBe(day("2026-10-10"));
      expect(update).not.toHaveBeenCalled();
    });

    it("picks with Enter on the focused day", async () => {
      const { update } = mount({ modelValue: "2026-10-20" });
      const grid = screen.getByRole("grid");
      day("2026-10-20").focus();
      await keys(grid, "ArrowRight");
      // A real browser turns Enter on a button into a click.
      await fireEvent.click(document.activeElement as HTMLElement);
      expect(update).toHaveBeenCalledWith("2026-10-21");
    });
  });

  describe("month picker", () => {
    it("opens a month and year grid from the title and jumps", async () => {
      mount({ modelValue: "2026-10-20", monthPicker: true });
      await fireEvent.click(screen.getByRole("button", { name: "Odaberi mjesec i godinu" }));
      expect(screen.queryByRole("grid")).toBeNull();
      await fireEvent.click(screen.getByRole("button", { name: "ožujak 2026" }));
      expect(screen.getByText("ožujak 2026.")).toBeTruthy();
      expect(screen.getByRole("grid")).toBeTruthy();
    });
  });

  it("follows a new value to its month", async () => {
    const view = mount({ modelValue: "2026-10-20" });
    await view.rerender({ modelValue: "2027-03-05" });
    expect(screen.getByText("ožujak 2027.")).toBeTruthy();
  });
});
