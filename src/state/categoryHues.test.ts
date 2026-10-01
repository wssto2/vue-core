import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import Badge from "./Badge.vue";
import { HUES } from "./hue";

// The tokens are read from the stylesheet itself, so the numbers checked are the ones that ship.
const theme = readFileSync(join(__dirname, "..", "styles", "theme.css"), "utf8");
const block = (selector: string) => {
  const start = theme.indexOf(`\n${selector} {`);
  return theme.slice(start, theme.indexOf("\n}", start));
};
const modes = { light: block(":root"), dark: block(".dark") };
const token = (mode: keyof typeof modes, name: string): string => {
  const value = new RegExp(`--app-${name}: (#[0-9A-Fa-f]{6});`).exec(modes[mode])?.[1];
  if (!value) throw new Error(`--app-${name} is not a hex colour in the ${mode} theme`);
  return value.toUpperCase();
};

const channel = (value: number) => ((value /= 255) <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
/** WCAG 2 contrast ratio. */
const contrast = (a: string, b: string) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
};

const STATUSES = ["success", "warning", "danger", "info", "neutral"];

describe("category hues", () => {
  it("are nine, each with a content and a surface in both themes", () => {
    expect(HUES).toHaveLength(9);
    for (const mode of ["light", "dark"] as const) {
      for (const hue of HUES) {
        expect(token(mode, `category-${hue}-content`)).toMatch(/^#/);
        expect(token(mode, `category-${hue}-surface`)).toMatch(/^#/);
      }
    }
  });

  describe.each(["light", "dark"] as const)("%s theme", (mode) => {
    it.each(HUES)("%s: the label reads on the tint (WCAG AA, 4.5:1)", (hue) => {
      expect(contrast(token(mode, `category-${hue}-content`), token(mode, `category-${hue}-surface`))).toBeGreaterThanOrEqual(4.5);
    });

    it.each(HUES)("%s: the dot shows against the cell it sits on (3:1 for graphics)", (hue) => {
      expect(contrast(token(mode, `category-${hue}-content`), token(mode, "surface-cell"))).toBeGreaterThanOrEqual(3);
    });

    it("the dot style's neutral label reads on the cell", () => {
      expect(contrast(token(mode, "content-default"), token(mode, "surface-cell"))).toBeGreaterThanOrEqual(4.5);
    });

    it("no hue borrows a status colour", () => {
      const status = STATUSES.flatMap((name) => [token(mode, `status-${name}-content`), token(mode, `status-${name}-surface`)]);
      for (const hue of HUES) {
        expect(status).not.toContain(token(mode, `category-${hue}-content`));
        expect(status).not.toContain(token(mode, `category-${hue}-surface`));
      }
    });
  });
});

describe("Badge hue", () => {
  it.each(HUES)("%s is tinted by default, with the label", (hue) => {
    const { container } = render(Badge, { props: { hue }, slots: { default: "Instagram" } });
    const badge = container.firstElementChild!;
    expect(badge.textContent?.trim()).toBe("Instagram");
    expect(badge.classList).toContain(`bg-category-${hue}-surface`);
    expect(badge.classList).toContain(`text-category-${hue}-content`);
    expect(badge.querySelector("span")).toBeNull();
  });

  it("the dot style keeps the label neutral and colours the dot", () => {
    const { container } = render(Badge, { props: { hue: "violet", appearance: "dot" }, slots: { default: "Instagram" } });
    const badge = container.firstElementChild!;
    expect(badge.textContent?.trim()).toBe("Instagram");
    expect(badge.classList).toContain("bg-surface-cell");
    expect(badge.classList).not.toContain("text-category-violet-content");
    const dot = badge.querySelector("span")!;
    expect(dot.classList).toContain("bg-category-violet-content");
    expect(dot.getAttribute("aria-hidden")).toBe("true");
  });

  it("a hue replaces the tone", () => {
    const { container } = render(Badge, { props: { hue: "teal", tone: "critical" }, slots: { default: "x" } });
    expect(container.firstElementChild!.className).not.toContain("status-danger");
  });
});
