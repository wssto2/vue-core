import { describe, expect, it } from "vitest";
import {
  controlSurface, controlSurfacePairs, controlWidthPair,
  type ClassPair, type ControlKind, type ControlState, type ControlWidth,
} from "./controlSurface";

const KINDS: ControlKind[] = ["text", "area", "popup", "date"];
const STATES: ControlState[] = ["rest", "error", "locked"];
const WIDTHS: ControlWidth[] = ["sm", "md", "lg", "full", "content"];

/** "focus-within:ring-[1.5px]" → { variants: "focus-within", property: "ring" }. */
function key(token: string) {
  const parts = token.split(":");
  const utility = parts.pop()!;
  return { variants: parts.filter((part) => part !== "compact").join(":"), property: utility.split("-")[0] };
}

function expectPaired([desktop, compact]: ClassPair) {
  const compactTokens = compact.split(" ");
  expect(compactTokens.every((token) => token.startsWith("compact:")), compact).toBe(true);
  expect(desktop.split(" ").some((token) => token.includes("compact:")), desktop).toBe(false);
  for (const token of desktop.split(" ")) {
    const wanted = key(token);
    const match = compactTokens.some((other) => {
      const found = key(other);
      return found.property === wanted.property && (found.variants === wanted.variants || found.variants.startsWith("focus"));
    });
    expect(match, `${token} has no compact counterpart in "${compact}"`).toBe(true);
  }
}

describe("controlSurface", () => {
  it("pairs every desktop class with a compact counterpart", () => {
    for (const kind of KINDS) for (const state of STATES) controlSurfacePairs(kind, state).forEach(expectPaired);
    for (const width of WIDTHS) expectPaired(controlWidthPair(width));
  });

  it("rest: the fill with a hover and a focus ring; typed fields turn to the cell colour while focused", () => {
    const text = controlSurface({ kind: "text" }).split(" ");
    expect(text).toEqual(expect.arrayContaining(["bg-fill", "hover:bg-fill-strong", "focus-within:bg-surface-cell", "focus-within:ring-border-focus", "rounded-control", "px-2.5"]));
    const popup = controlSurface({ kind: "popup" }).split(" ");
    expect(popup).toEqual(expect.arrayContaining(["bg-fill", "hover:bg-fill-strong", "focus-within:ring-border-focus"]));
    expect(popup).not.toContain("focus-within:bg-surface-cell");
    expect(popup).not.toContain("px-2.5");
  });

  it("error: the danger surface and a destructive ring, focused too; no hover", () => {
    for (const kind of KINDS) {
      const classes = controlSurface({ kind, state: "error" }).split(" ");
      expect(classes).toEqual(expect.arrayContaining(["bg-status-danger-surface", "ring-border-destructive", "focus-within:ring-border-destructive"]));
      expect(classes).not.toContain("hover:bg-fill-strong");
      expect(classes).not.toContain("focus-within:ring-border-focus");
    }
  });

  it("locked: the control's shape dimmed, nothing to hover or focus", () => {
    for (const kind of KINDS) {
      const classes = controlSurface({ kind, state: "locked" }).split(" ");
      expect(classes).toEqual(expect.arrayContaining(["bg-fill", "opacity-45", "cursor-not-allowed"]));
      expect(classes.some((token) => token.startsWith("hover:") || token.startsWith("focus-within:"))).toBe(false);
    }
  });

  it("compact keeps today's presentation: plain text fields and select, the date capsule", () => {
    expect(controlSurface({ kind: "text" })).toContain("compact:bg-transparent");
    expect(controlSurface({ kind: "area" })).toContain("compact:px-0");
    expect(controlSurface({ kind: "popup" })).toContain("compact:bg-transparent");
    expect(controlSurface({ kind: "popup", state: "error" })).toContain("compact:bg-status-danger-surface");
    expect(controlSurface({ kind: "date" })).toContain("compact:bg-fill");
    expect(controlSurface({ kind: "text", state: "error" })).toContain("compact:ring-0");
  });

  it("a disabled picker stays dimmed on compact screens; a typed field turns plain", () => {
    expect(controlSurface({ kind: "popup", state: "locked" })).toContain("compact:opacity-45");
    expect(controlSurface({ kind: "text", state: "locked" })).toContain("compact:opacity-100");
  });

  it("uses semantic tokens only", () => {
    const palette = /(?:^|:)(?:bg|ring|outline|text)-(?:gray|red|green|primary|white|black|emerald|slate)\b/;
    for (const kind of KINDS) for (const state of STATES) {
      for (const token of controlSurface({ kind, state }).split(" ")) expect(token).not.toMatch(palette);
    }
  });
});
