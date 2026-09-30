import { render } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import { defineComponent, h, ref } from "vue";
import { createFormatting, installFormatting, toDate, useFormat } from "./format";
import { MissingContextError } from "../platform";

const instant = new Date(2026, 8, 30, 14, 5); // local time: 30 Sep 2026, 14:05

describe("toDate", () => {
  it("reads a calendar date as that day and rejects what is not a date", () => {
    expect(toDate("2026-01-01")!.getDate()).toBe(1);
    expect(toDate("2026-01-01")!.getMonth()).toBe(0);
    for (const value of [undefined, null, "", "not a date", "0001-01-01T00:00:00Z", "0001-01-01", "1970-01-01T00:00:00Z", new Date(NaN), 0]) {
      expect(toDate(value)).toBeNull();
    }
    expect(toDate(instant.getTime())).toEqual(instant);
  });
});

describe("createFormatting", () => {
  it("formats dates numerically by default, in the active locale", () => {
    const locale = ref("hr");
    const format = createFormatting({ locale: () => locale.value });

    expect(format.date(instant)).toBe("30. 09. 2026.");
    expect(format.dateTime(instant)).toMatch(/^30\. 09\. 2026\.,? 14:05$/);
    expect(format.time(instant)).toBe("14:05");

    locale.value = "en";
    expect(format.date(instant)).toBe("09/30/2026");
    expect(format.locale).toBe("en");
  });

  it("formats numbers and money for the locale", () => {
    const format = createFormatting({ locale: () => "hr" });

    expect(format.number(1234.5)).toMatch(/^1\.?234,5$/); // the ICU data decides whether hr groups four digits
    expect(format.number(0.256, { style: "percent" })).toMatch(/^26\s%$/);
    expect(format.money(1234.5, "EUR")).toMatch(/^1\.?234,50\s€$/);
    expect(createFormatting({ locale: () => "en" }).money(1234.5, "USD")).toBe("$1,234.50");
  });

  it("says the largest whole unit relative to now", () => {
    const format = createFormatting({ locale: () => "en" });
    const now = new Date(2026, 8, 30, 12, 0);

    expect(format.relative(new Date(2026, 8, 27, 12, 0), now)).toBe("3 days ago");
    expect(format.relative(new Date(2026, 8, 30, 14, 0), now)).toBe("in 2 hours");
    expect(format.relative(new Date(2026, 8, 30, 12, 0, 20), now)).toBe("in 20 seconds");
    expect(format.relative(now, now)).toBe("now");
  });

  it("has nothing to show for nothing", () => {
    const format = createFormatting({ locale: () => "en" });

    expect(format.date(null)).toBe("");
    expect(format.dateTime("0001-01-01T00:00:00Z")).toBe("");
    expect(format.time("garbage")).toBe("");
    expect(format.number(NaN)).toBe("");
    expect(format.number(undefined)).toBe("");
    expect(format.money(null, "EUR")).toBe("");
    expect(format.relative(undefined)).toBe("");
  });

  it("lets the app replace one formatter and keeps the rest", () => {
    const pad = (value: number) => String(value).padStart(2, "0");
    const format = createFormatting({
      locale: () => "hr",
      formatters: { date: (value) => `${pad(value.getDate())}.${pad(value.getMonth() + 1)}.${value.getFullYear()}.` },
    });

    expect(format.date(instant)).toBe("30.09.2026.");
    expect(format.time(instant)).toBe("14:05");
  });
});

describe("useFormat", () => {
  const Probe = defineComponent({ setup: () => { const format = useFormat(); return () => h("p", format.date(instant)); } });

  it("re-renders when the locale changes", async () => {
    const locale = ref("en");
    const { container } = render(Probe, {
      global: { plugins: [{ install: (app) => installFormatting(app, createFormatting({ locale: () => locale.value })) }] },
    });
    expect(container.textContent).toBe("09/30/2026");

    locale.value = "hr";
    await Promise.resolve();
    await Promise.resolve();
    expect(container.textContent).toBe("30. 09. 2026.");
  });

  it("fails with an actionable error when the app installed no formatting", () => {
    expect(() => render(Probe)).toThrow(MissingContextError);
    expect(() => render(Probe)).toThrow(/vue-core\.formatting.*installFormatting|vue-core\.formatting.*app\.provide/s);
  });
});
