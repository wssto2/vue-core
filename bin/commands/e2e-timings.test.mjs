import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "../cli.mjs";

const cache = join(process.cwd(), "node_modules", ".cache", "e2e-timings");
mkdirSync(cache, { recursive: true });

const report = {
  stats: { duration: 12500 },
  suites: [
    {
      file: "a.spec.ts",
      specs: [{ title: "fast", tests: [{ status: "expected", results: [{ duration: 1000 }] }] }],
      suites: [{ title: "nested", specs: [{ title: "slow", tests: [{ status: "flaky", results: [{ duration: 4000 }, { duration: 3000 }] }] }] }],
    },
    { file: "b.spec.ts", specs: [{ title: "mid", tests: [{ status: "expected", results: [{ duration: 2000 }] }] }] },
  ],
};

const run = async (argv, cwd) => {
  const out = [];
  const err = [];
  const code = await main(argv, { cwd, out: (text) => out.push(text), err: (text) => err.push(text) });
  return { code, out: out.join("\n"), err: err.join("\n") };
};

describe("vue-core e2e-timings", () => {
  it("lists the slowest files and tests of the configured report, nested suites included", async () => {
    const dir = mkdtempSync(join(cache, "case-"));
    mkdirSync(join(dir, "e2e-timings"));
    writeFileSync(join(dir, "e2e-timings/results.json"), JSON.stringify(report));
    const { code, out } = await run(["e2e-timings", "--top", "2"], dir);
    expect(code).toBe(0);
    expect(out).toBe(
      [
        "3 tests, 10.0s of test time, 12.5s wall clock\n",
        "Slowest files (test time, share, tests):",
        "   8.0s   80.0%    2  a.spec.ts",
        "   2.0s   20.0%    1  b.spec.ts",
        "\nSlowest tests:",
        "   7.0s  a.spec.ts › slow [flaky]",
        "   2.0s  b.spec.ts › mid",
      ].join("\n"),
    );
  });

  it("--report names another file, relative to where it runs; the configured one is relative to the config", async () => {
    const dir = mkdtempSync(join(cache, "case-"));
    writeFileSync(join(dir, "other.json"), JSON.stringify(report));
    writeFileSync(join(dir, "vue-core.config.mjs"), 'export default { e2eTimings: { report: "results/x.json" } };');
    mkdirSync(join(dir, "sub"));
    expect((await run(["e2e-timings", "--report", "../other.json"], join(dir, "sub"))).code).toBe(0);
    const { code, err } = await run(["e2e-timings"], join(dir, "sub"));
    expect(code).toBe(1);
    expect(err).toBe("No results/x.json — run the e2e suite first (npm run test:e2e).");
  });
});
