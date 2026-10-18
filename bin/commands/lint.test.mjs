// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULTS } from "../config.mjs";
import lint, { changedFiles, resolveBase } from "./lint.mjs";

const cache = join(process.cwd(), "node_modules", ".cache", "v1-lint"); // Vite, which runs the tests, cannot import from /tmp
const BASELINE = "scripts/lint-baselines.json";
const SYNTACTIC_BAD = "console.log(1);\n"; // no-console is `warn`: ratcheted
const ENV = ["LINT_TYPED", "LINT_BASE", "GITHUB_BASE_REF"];
const saved = Object.fromEntries(ENV.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of ENV) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

/** A fixture tree: `files` maps a path to its content; the eslint config has one ratcheted rule, one error rule and a stand-in typed rule. */
function tree(name, files, baseline) {
  const root = join(cache, name);
  rmSync(root, { recursive: true, force: true });
  const all = {
    "eslint.config.mjs": `
      const typedStandIn = { rules: { "await-thenable": { create: (context) => ({ CallExpression(node) { if (node.callee.name === "bad") context.report({ node, message: "bad call" }); } }) } } };
      export default [
        { files: ["**/*.js"], rules: { "no-console": "warn", "no-debugger": "error" } },
        { files: ["**/*.ts"], plugins: { "@typescript-eslint": typedStandIn }, rules: { "@typescript-eslint/await-thenable": "warn" } },
      ];`,
    ...files,
  };
  if (baseline) all[BASELINE] = JSON.stringify(baseline, null, 2) + "\n";
  for (const [file, content] of Object.entries(all)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  return root;
}

async function run(root, args = [], config = {}) {
  const out = [];
  const err = [];
  const code = await lint({ args, config: { ...DEFAULTS.lint, ...config }, root, out: (text) => out.push(text), err: (text) => err.push(text) });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

const baselineOf = (root) => JSON.parse(readFileSync(join(root, BASELINE), "utf8"));
const rawBaseline = (root) => readFileSync(join(root, BASELINE), "utf8");

describe("the ratchet (untyped, whole tree)", () => {
  it("a count over its ceiling fails and lists the offending lines", async () => {
    const root = tree("over", { "a.js": SYNTACTIC_BAD + SYNTACTIC_BAD }, { syntacticByFile: { "a.js": { "no-console": 1 } } });
    const { code, err } = await run(root);
    expect(code).toBe(1);
    expect(err).toContain("lint ratchet: 1 NEW violation(s).");
    expect(err).toContain("    no-console: 2, was 1 (+1)");
    expect(err).toContain("      a.js:1:1  Unexpected console statement.");
    expect(err).toContain("      a.js:2:1  Unexpected console statement.");
    expect(err).toContain("see the project's lint policy.");
  });

  it("a count below its ceiling fails with 'lock it in' and the update command", async () => {
    const root = tree("below", { "a.js": SYNTACTIC_BAD }, { syntacticByFile: { "a.js": { "no-console": 3 } } });
    const { code, err } = await run(root);
    expect(code).toBe(1);
    expect(err).toContain("lint ratchet: 2 violation(s) fixed — lock it in:");
    expect(err).toContain("    no-console: 3 -> 1");
    expect(err).toContain("  vue-core lint --update && git add scripts/lint-baselines.json");
  });

  it("a count at its ceiling is clean; an error never is", async () => {
    const root = tree("at", { "a.js": SYNTACTIC_BAD }, { syntacticByFile: { "a.js": { "no-console": 1 } } });
    const clean = await run(root);
    expect(clean).toMatchObject({ code: 0, out: "eslint: clean — whole tree, 1 grandfathered violation(s) at ceiling, none new" });
    writeFileSync(join(root, "b.js"), "debugger;\n");
    const { code, err } = await run(root);
    expect(code).toBe(1);
    expect(err).toContain("eslint: errors must be fixed — they are not ratcheted.");
  });

  it("the command names, the policy and the baseline path come from the config", async () => {
    const root = tree("config", { "a.js": SYNTACTIC_BAD }, undefined);
    writeFileSync(join(root, "lint.json"), JSON.stringify({ syntacticByFile: { "a.js": { "no-console": 2 } } }));
    const config = { baselines: "lint.json", commands: { update: "npm run lint:update-baselines" }, policy: "documentation/rules.md" };
    const { code, err } = await run(root, [], config);
    expect(code).toBe(1);
    expect(err).toContain("  npm run lint:update-baselines && git add lint.json");
  });

  it("a pattern counter (debt ESLint cannot count) is a ratcheted count of its own and skips the generated folders", async () => {
    const disables = "// TODO(debt)\n// TODO(debt)\n";
    const root = tree("pattern", { "a.js": disables, "gen/g.js": disables }, { patternByFile: { "a.js": { debts: 1 } } });
    const patternCounters = [{ name: "debts", extensions: [".js"], pattern: /TODO\(debt\)/g, hint: "pay it" }];
    const { code, err } = await run(root, [], { patternCounters, generated: ["gen"] });
    expect(code).toBe(1);
    expect(err).toContain("    debts: 2, was 1 (+1)");
    expect(err).toContain("      a.js:2  pay it");
    expect(err).not.toContain("gen/g.js");
  });
});

describe("--update", () => {
  it("lowers a ceiling, removes a dead entry and an entry that reached zero, and keeps the header", async () => {
    const root = tree(
      "update",
      { "a.js": SYNTACTIC_BAD, "clean.js": "export {};\n" },
      { _comment: ["hand-kept header"], syntacticByFile: { "a.js": { "no-console": 3 }, "clean.js": { "no-console": 1 }, "gone.js": { "no-console": 2 } }, patternByFile: {}, typedByFile: { "x.ts": { "@typescript-eslint/await-thenable": 4 } } },
    );
    const { code, out } = await run(root, ["--update"]);
    expect(code).toBe(0);
    expect(out).toContain("baselines written to scripts/lint-baselines.json (fast)");
    expect(baselineOf(root)).toEqual({
      _comment: ["hand-kept header"],
      syntacticByFile: { "a.js": { "no-console": 1 } },
      patternByFile: {},
      typedByFile: { "x.ts": { "@typescript-eslint/await-thenable": 4 } }, // the typed section is not the untyped run's to judge
    });
    expect((await run(root)).code).toBe(0); // and the next check is clean
  });

  it("on a tree at its ceilings it leaves the file byte-identical", async () => {
    const root = tree("stable", { "a.js": SYNTACTIC_BAD }, { _comment: ["x"], syntacticByFile: { "a.js": { "no-console": 1 } }, patternByFile: {}, typedByFile: {} });
    const before = rawBaseline(root);
    await run(root, ["--update"]);
    expect(rawBaseline(root)).toBe(before);
  });

  it("writes the driver's header when the baseline file does not exist yet, and a missing file is no ceilings", async () => {
    const root = tree("seed", { "a.js": SYNTACTIC_BAD });
    expect((await run(root)).code).toBe(1); // no ceiling: the violation is new
    await run(root, ["--update"]);
    const written = baselineOf(root);
    expect(written._comment[0]).toBe("Count ratchet. Generated by `vue-core lint` — do not hand-edit.");
    expect(written._comment.at(-1)).toBe("Reseed: vue-core lint --update && LINT_TYPED=1 vue-core lint --update --all");
    expect(written.syntacticByFile).toEqual({ "a.js": { "no-console": 1 } });
    expect((await run(root)).code).toBe(0);
  });
});

describe("typed mode (a stand-in rule from the typed list)", () => {
  const baseline = () => ({
    _comment: ["h"],
    syntacticByFile: { "keep.js": { "no-console": 9 } },
    patternByFile: {},
    typedByFile: { "a.ts": { "@typescript-eslint/await-thenable": 3 }, "b.ts": { "@typescript-eslint/await-thenable": 5 }, "gone.ts": { "@typescript-eslint/await-thenable": 1 } },
  });
  const files = { "a.ts": "bad();\n", "b.ts": "bad();\nbad();\n", "c.ts": "export {};\n" };

  it("judges only the files in --file scope; the rest keep their recorded ceilings", async () => {
    process.env.LINT_TYPED = "1";
    const root = tree("typed-file", files, baseline());
    const { code, out, err } = await run(root, ["--file=a.ts"]);
    expect(out).toBe("lint (typed): 1 file(s)");
    expect(code).toBe(1);
    expect(err).toContain("lint ratchet: 2 violation(s) fixed — lock it in:");
    expect(err).toContain("  LINT_TYPED=1 vue-core lint --update && git add");
    expect(err).not.toContain("b.ts"); // out of scope: never judged
  });

  it("--update --file lowers only the entries of the files in scope", async () => {
    process.env.LINT_TYPED = "1";
    const root = tree("typed-update", files, baseline());
    await run(root, ["--update", "--file=a.ts"]);
    expect(baselineOf(root)).toEqual({
      ...baseline(),
      typedByFile: { "a.ts": { "@typescript-eslint/await-thenable": 1 }, "b.ts": { "@typescript-eslint/await-thenable": 5 }, "gone.ts": { "@typescript-eslint/await-thenable": 1 } },
    });
  });

  it("--update --all reseeds the typed section, which drops a dead entry; the untyped sections stay", async () => {
    process.env.LINT_TYPED = "1";
    const root = tree("typed-all", files, baseline());
    const { out } = await run(root, ["--update", "--all"]);
    expect(out).toContain("(typed, full tree)");
    expect(baselineOf(root)).toEqual({
      ...baseline(),
      typedByFile: { "a.ts": { "@typescript-eslint/await-thenable": 1 }, "b.ts": { "@typescript-eslint/await-thenable": 2 } },
    });
  });

  it("a filter that matches nothing lints nothing", async () => {
    process.env.LINT_TYPED = "1";
    const root = tree("typed-none", files, baseline());
    expect(await run(root, ["--file=zzz"])).toMatchObject({ code: 0, out: 'lint (typed): no .ts/.vue file path contains "zzz" — nothing to check' });
  });
});

describe("--report", () => {
  it("ranks the grandfathered debt and names the commands that pay it down", async () => {
    const root = tree("report", { "a.js": SYNTACTIC_BAD + SYNTACTIC_BAD, "b.js": SYNTACTIC_BAD });
    const { code, out } = await run(root, ["--report", "--summary"], { commands: { typedReport: "npm run r", typedReportAll: "npm run r:all" } });
    expect(code).toBe(0);
    expect(out).toContain("grandfathered debt: 3 violation(s) in 2 file(s)");
    expect(out).toContain("      3  no-console");
    expect(out).toContain("      2  a.js\n      1  b.js");
    expect(out).toContain("\nFix some, then: vue-core lint --update\n");
    expect(out).toContain("  npm run r        # changed files\n  npm run r:all    # whole tree, ~22min");
    expect(out).not.toContain("a.js:1:1");
    expect((await run(root, ["--report", "--rule=zzz"])).out).toBe("no grandfathered violations match that filter — nothing to pay down");
  });
});

describe("the change base", () => {
  /** A fake git: `refs` maps a ref to its merge-base and commit time; `upstream` is what @{upstream} names (null: no tracking branch). */
  const fakeGit = ({ refs = {}, upstream = null } = {}) => (args) => {
    const [cmd, ...rest] = args;
    if (cmd === "merge-base") {
      const ref = rest[1];
      if (!refs[ref]) throw new Error("unknown ref");
      return refs[ref].base;
    }
    if (cmd === "show") return String(Object.values(refs).find((entry) => entry.base === rest[2])?.time ?? 0);
    if (cmd === "rev-parse") {
      if (!upstream) throw new Error("no upstream");
      return upstream;
    }
    throw new Error(`unexpected git ${args.join(" ")}`);
  };

  it("LINT_BASE wins, then GITHUB_BASE_REF, then the upstream, then the nearest trunk", () => {
    const refs = {
      "origin/feature": { base: "bUpstream", time: 5 },
      "origin/release": { base: "bPr", time: 1 },
      LINT: { base: "bExplicit", time: 1 },
      "origin/main": { base: "bMain", time: 10 },
      dev: { base: "bDev", time: 20 },
    };
    const git = fakeGit({ refs, upstream: "origin/feature" });
    expect(resolveBase(git)).toBe("bUpstream");
    process.env.GITHUB_BASE_REF = "release";
    expect(resolveBase(git)).toBe("bPr");
    process.env.LINT_BASE = "LINT";
    expect(resolveBase(git)).toBe("bExplicit");
    process.env.LINT_BASE = "unknown"; // an explicit base that does not resolve falls through
    expect(resolveBase(git)).toBe("bPr");
  });

  it("without an upstream the nearest trunk by merge-base date wins, not the first that resolves", () => {
    const refs = { "origin/main": { base: "bMain", time: 10 }, dev: { base: "bDev", time: 20 }, master: { base: "bMaster", time: 15 } };
    expect(resolveBase(fakeGit({ refs }))).toBe("bDev");
  });

  it("no base at all (a shallow clone) is null", () => {
    expect(resolveBase(fakeGit())).toBeNull();
  });
});

describe("the git prefix", () => {
  const git = (cwd, ...args) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd, encoding: "utf8" });

  /** A repository with the application in `sub` ("" for the top): a committed file, then a changed one, a new staged one, an untracked one and a generated one. */
  function repo(name, sub) {
    const top = join(cache, name);
    rmSync(top, { recursive: true, force: true });
    const app = join(top, sub);
    const put = (file, content) => {
      mkdirSync(dirname(join(app, file)), { recursive: true });
      writeFileSync(join(app, file), content);
    };
    mkdirSync(top, { recursive: true });
    git(top, "init", "-q", "-b", "main");
    put("changed.ts", "export const a = 1;\n");
    put("same.ts", "export const b = 1;\n");
    put("generated/g.ts", "export const g = 1;\n");
    if (sub) writeFileSync(join(top, "outside.ts"), "export const o = 1;\n");
    git(top, "add", ".");
    git(top, "commit", "-q", "-m", "base");
    git(top, "checkout", "-q", "-b", "feature");
    put("changed.ts", "export const a = 2;\n");
    put("staged.vue", "<template><p /></template>\n");
    put("generated/g.ts", "export const g = 2;\n");
    put("notes.md", "x\n");
    if (sub) writeFileSync(join(top, "outside.ts"), "export const o = 2;\n");
    git(app, "add", "staged.vue");
    put("untracked.ts", "export const u = 1;\n");
    return app;
  }

  it.each([["a monorepo folder", "frontend"], ["the repository top", ""]])("%s: .ts/.vue files changed since the branch point, relative to the application, generated code left out", (_name, sub) => {
    const app = repo(`prefix-${sub || "top"}`, sub);
    expect(changedFiles(app, ["generated"]).sort()).toEqual(["changed.ts", "staged.vue", "untracked.ts"]);
  });

  it("outside a git checkout it lints the whole tree (null)", () => {
    expect(changedFiles(join(cache, "no-such-folder"), [])).toBeNull();
  });
});
