// Summarises a Playwright JSON report (the `json` reporter, `e2eTimings.report`): the slowest spec files and tests,
// so trimming or splitting the e2e suite starts from measurements.
//   vue-core e2e-timings [--report <path>] [--top 20]
import { readFileSync } from "node:fs";
import path from "node:path";

export default function run({ args, config, root, cwd, out, err }) {
  const topArg = args.indexOf("--top");
  const TOP = topArg >= 0 ? Number(args[topArg + 1]) || 15 : 15;
  const reportArg = args.indexOf("--report");
  const REPORT = reportArg >= 0 ? args[reportArg + 1] : config.report;
  // a `--report` is relative to where the command runs, the configured one to the config's folder
  const reportPath = reportArg >= 0 ? path.resolve(cwd, REPORT) : path.resolve(root, REPORT);

  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch {
    err(`No ${REPORT} — run the e2e suite first (npm run test:e2e).`);
    return 1;
  }

  const tests = [];
  function walk(suite, file) {
    const here = suite.file ?? file;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const duration = (test.results ?? []).reduce((sum, result) => sum + (result.duration ?? 0), 0);
        tests.push({ file: here, title: spec.title, duration, status: test.status });
      }
    }
    for (const child of suite.suites ?? []) walk(child, here);
  }
  for (const suite of report.suites ?? []) walk(suite, suite.file);

  const byFile = new Map();
  for (const test of tests) {
    const entry = byFile.get(test.file) ?? { file: test.file, duration: 0, count: 0 };
    entry.duration += test.duration;
    entry.count += 1;
    byFile.set(test.file, entry);
  }

  const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`.padStart(7);
  const total = tests.reduce((sum, test) => sum + test.duration, 0);
  const wall = report.stats?.duration ?? 0;

  out(`${tests.length} tests, ${seconds(total).trim()} of test time, ${seconds(wall).trim()} wall clock\n`);
  out(`Slowest files (test time, share, tests):`);
  for (const entry of [...byFile.values()].sort((a, b) => b.duration - a.duration).slice(0, TOP)) {
    out(`${seconds(entry.duration)}  ${((entry.duration / total) * 100).toFixed(1).padStart(5)}%  ${String(entry.count).padStart(3)}  ${entry.file}`);
  }
  out(`\nSlowest tests:`);
  for (const test of [...tests].sort((a, b) => b.duration - a.duration).slice(0, TOP)) {
    out(`${seconds(test.duration)}  ${test.file} › ${test.title}${test.status === "expected" ? "" : ` [${test.status}]`}`);
  }
  return 0;
}
