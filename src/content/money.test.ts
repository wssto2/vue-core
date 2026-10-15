import { render } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import type { Plugin } from "vue";
import { createFormatting, installFormatting, type Formatters } from "../format";
import Money from "./Money.vue";

// ARV-style: "." groups, "," decimals, whatever the language.
const grouped: Partial<Formatters> = {
  number: (value, _locale, options) => {
    const digits = options?.minimumFractionDigits ?? 0;
    const [whole, fraction] = value.toFixed(digits).split(".");
    return whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (fraction ? `,${fraction}` : "");
  },
};

function plugin(options: { currencySymbol?: string; formatters?: Partial<Formatters> } = { currencySymbol: "€", formatters: grouped }): Plugin {
  return { install: (app) => installFormatting(app, createFormatting({ locale: () => "en", ...options })) };
}

function text(props: Record<string, unknown>, options?: Parameters<typeof plugin>[0]) {
  const { container } = render(Money, { props: props as { amount: number | null }, global: { plugins: [plugin(options)] } });
  return { el: container.firstElementChild as HTMLElement, text: container.textContent };
}

describe("Money", () => {
  it("formats through the application's number format, then the symbol", () => {
    expect(text({ amount: 12000 }).text).toBe("12.000,00€");
    expect(text({ amount: 1234.5 }).el.textContent).toBe("1.234,50€");
    // The symbol is its own, quieter span, a space away.
    const { el } = text({ amount: 5 });
    expect(el.querySelector("span.ml-1")!.textContent).toBe("€");
    expect(el.className).toContain("tabular-nums");
  });

  it("falls back to Intl when the application has no number format", () => {
    expect(text({ amount: 1234.5 }, { currencySymbol: "KM" }).text).toBe("1,234.50KM");
  });

  it("symbol=false drops the symbol; an application without one shows none", () => {
    expect(text({ amount: 5, symbol: false }).text).toBe("5,00");
    expect(text({ amount: 5 }, { formatters: grouped }).text).toBe("5,00");
  });

  it("decimals sets the fraction digits", () => {
    expect(text({ amount: 1234.5678, decimals: 3 }).text).toBe("1.234,568€");
    expect(text({ amount: 7, decimals: 0 }).text).toBe("7€");
  });

  it("whole drops the fraction of an amount that has none, and only that", () => {
    expect(text({ amount: 39600, whole: true }).text).toBe("39.600€");
    expect(text({ amount: 39600.5, whole: true }).text).toBe("39.600,50€");
  });

  it("a missing amount reads as zero; emptyZero shows a dash for null and 0 only", () => {
    expect(text({ amount: null }).text).toBe("0,00€");
    expect(text({ amount: undefined }).text).toBe("0,00€");
    expect(text({ amount: null, emptyZero: true }).text).toBe("—");
    expect(text({ amount: 0, emptyZero: true }).text).toBe("—");
    expect(text({ amount: 3, emptyZero: true }).text).toBe("3,00€");
  });

  it("signed shows + and green for a rise, a minus and red for a fall, plain at zero", () => {
    const up = text({ amount: 250, signed: true });
    expect(up.text).toBe("+250,00€");
    expect(up.el.className).toContain("text-status-success-content");

    const down = text({ amount: -250, signed: true });
    expect(down.text).toBe("−250,00€");
    expect(down.el.className).toContain("text-status-danger-content");

    for (const amount of [0, null, 0.001, -0.004]) {
      const plain = text({ amount, signed: true });
      expect(plain.text).not.toMatch(/[+−]/);
      expect(plain.el.className).not.toContain("text-status");
    }
    expect(text({ amount: -250 }).text).toBe("-250,00€");
  });
});
