import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = __dirname;

function* sources(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sources(path);
    else if (/\.(vue|ts)$/.test(entry.name) && !/\.test(-d)?\.ts$/.test(entry.name)) yield path;
  }
}

const code = [...sources(src)].map((path) => ({ path, text: readFileSync(path, "utf8") }));
const theme = readFileSync(join(src, "styles", "theme.css"), "utf8");

// Reduced motion: every duration in the components comes from a token, and the tokens are zero.
describe("reduced motion", () => {
  it("zeroes the motion tokens under prefers-reduced-motion", () => {
    const block = theme.match(/@media \(prefers-reduced-motion: reduce\) \{\s*:root \{([^}]*)\}/)?.[1] ?? "";

    for (const token of ["--app-motion-fast", "--app-motion-normal", "--app-motion-sheet", "--app-motion-reveal"]) {
      expect(block, token).toMatch(new RegExp(`${token}:\\s*0ms`));
    }
  });

  it("no component sets a fixed transition duration", () => {
    const offenders = code
      .filter(({ text }) => /(?<![-\w])duration-\d/.test(text))
      .map(({ path }) => path.replace(src, "src"));

    expect(offenders).toEqual([]);
  });

  it("every keyframe animation in a component has a reduced-motion answer", () => {
    // Arbitrary `animate-[…]` needs `motion-reduce:` beside it; named animations (`animate-spin`,
    // `animate-pulse`, `animate-text-swap`…) are covered by the theme or are functional spinners.
    const offenders = code
      .filter(({ text }) => /animate-\[/.test(text) && !/motion-reduce:/.test(text))
      .map(({ path }) => path.replace(src, "src"));

    expect(offenders).toEqual([]);
  });

  it("the shimmer stops under reduced motion", () => {
    expect(theme).toMatch(/text-shimmer[\s\S]*?prefers-reduced-motion: reduce[\s\S]*?animation: none/);
  });
});
