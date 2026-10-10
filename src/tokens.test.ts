// The colour pairs and touch sizes the design depends on, computed from the token values in theme.css (no browser): a re-brand that
// breaks a pair, or a control that loses its hit area, fails here. Rendered measurement is not part of this file.
import { fireEvent, render, screen } from "@testing-library/vue";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import Button from "./button/Button.vue";
import DateButton from "./controls/DateButton.vue";
import PopupButton from "./controls/PopupButton.vue";
import SwitchField from "./form/SwitchField.vue";
import { testFormatting } from "./testing/format";
import { createTestI18n } from "./testing/i18n";

const css = readFileSync("src/styles/theme.css", "utf8") /* vitest runs from the package root */;

/** The declarations of a top-level rule, `--app-*` tokens only. */
function block(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `${selector} rule`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("\n}", start));
}
const tokens = (rule: string): Record<string, string> => Object.fromEntries([...rule.matchAll(/--app-([a-z-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
const light = tokens(block(":root"));
const dark = { ...light, ...tokens(block(".dark")) };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const SURFACES = ["surface-page", "surface-cell", "surface-raised", "surface-overlay"];
const STATUSES = ["success", "warning", "danger", "info", "neutral"];
const CATEGORIES = ["amber", "lime", "teal", "cyan", "blue", "indigo", "violet", "fuchsia", "pink"];

/** [text token, background token, minimum ratio]: 4.5 for text (WCAG AA), 3 for large text and UI components. */
const PAIRS: [string, string, number][] = [
  ...["content-default", "content-strong", "content-muted", "content-destructive", "tint"].flatMap((fg) => SURFACES.map((bg): [string, string, number] => [fg, bg, 4.5])),
  ["content-on-tint", "tint", 4.5],
  ["content-inverse", "surface-inverse", 4.5],
  ["content-inverse-accent", "surface-inverse", 4.5],
  ["content-inverse-danger", "surface-inverse", 4.5],
  ["content-default", "fill", 4.5],
  ["content-muted", "fill", 4.5],
  ...STATUSES.flatMap((tone): [string, string, number][] => [[`status-${tone}-content`, `status-${tone}-surface`, 4.5], [`status-${tone}-content`, "surface-cell", 4.5]]),
  ...CATEGORIES.map((name): [string, string, number] => [`category-${name}-content`, `category-${name}-surface`, 4.5]),
  ["border-control", "surface-cell", 3],
  ["border-destructive", "surface-cell", 3],
  ["control-on", "surface-cell", 3],
  ["tile-brand-foreground", "tile-brand", 3], // an icon on its tile, not text
];

describe("colour contrast (WCAG AA)", () => {
  for (const [mode, set] of [["light", light], ["dark", dark]] as const) {
    it.each(PAIRS)(`${mode}: %s on %s is at least %s:1`, (foreground, background, minimum) => {
      const fg = set[foreground];
      const bg = set[background];
      expect(fg, `--app-${foreground} is a #rrggbb in ${mode}`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(bg, `--app-${background} is a #rrggbb in ${mode}`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(contrast(fg!, bg!)).toBeGreaterThanOrEqual(minimum);
    });
  }

  it("white on a solid status fill is readable (a badge, the warning banner's button)", () => {
    for (const set of [light, dark]) for (const tone of STATUSES) expect(contrast("#FFFFFF", set[`status-${tone}-solid`]!)).toBeGreaterThanOrEqual(4.5);
  });

  it("the computation is the WCAG one", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
  });
});

describe("touch targets (44 CSS px)", () => {
  const rem = (value: string) => parseFloat(value) * 16;

  it("the hit area and the row are 44px on touch and narrow screens, and the hit-target utility grows to the hit area", () => {
    const touch = css.slice(css.indexOf("@media (max-width: 47.999rem), (any-pointer: coarse) {"));
    expect(rem(/--app-target-size:\s*([\d.]+rem)/.exec(touch)![1]!)).toBeGreaterThanOrEqual(44);
    const rows = css.slice(css.indexOf("@media (max-width: 47.999rem), (pointer: coarse) {"));
    expect(rem(/--app-row-height:\s*([\d.]+rem)/.exec(rows)![1]!)).toBeGreaterThanOrEqual(44);
    const utility = css.slice(css.indexOf("@utility hit-target"));
    expect(utility.slice(0, utility.indexOf("\n}\n"))).toContain("var(--app-target-size)");
  });

  afterEach(() => (document.body.innerHTML = ""));
  const i18n = createTestI18n();
  const global = { plugins: [i18n, testFormatting(i18n)] };

  it.each(["xs", "sm", "md", "lg", "xl"] as const)("a %s Button grows its hit area to the target size", (size) => {
    render(Button, { props: { size }, slots: { default: "Go" }, global });
    expect(screen.getByRole("button").className.split(/\s+/)).toContain("hit-target");
  });

  it("the small controls (switch, pop-up button, date button) grow theirs too", async () => {
    render(SwitchField, { props: { label: "On" }, global });
    expect(screen.getByRole("switch").className.split(/\s+/)).toContain("hit-target");
    document.body.innerHTML = "";
    render(PopupButton, { slots: { default: "Value" }, global });
    expect(screen.getByRole("button").className.split(/\s+/)).toContain("hit-target");
    document.body.innerHTML = "";
    render(DateButton, { slots: { default: "1. 1. 2026." }, global });
    await fireEvent.focus(screen.getByRole("button"));
    expect(screen.getByRole("button").className.split(/\s+/)).toContain("hit-target");
  });
});
