import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMMANDS, main } from "./cli.mjs";

const tmpdir = join(process.cwd(), "node_modules", ".cache"); // Vite, which runs the tests, cannot import a config outside the project
mkdirSync(tmpdir, { recursive: true });

const run = async (argv, options = {}) => {
  const out = [];
  const err = [];
  const code = await main(argv, { cwd: mkdtempSync(join(tmpdir, "cli-")), out: (text) => out.push(text), err: (text) => err.push(text), ...options });
  return { code, out: out.join("\n"), err: err.join("\n") };
};

describe("vue-core", () => {
  it("--help lists every command and exits 0", async () => {
    const { code, out } = await run(["--help"]);
    expect(code).toBe(0);
    for (const name of Object.keys(COMMANDS)) expect(out).toContain(name);
  });

  it("an unknown command or none exits 2 with the list", async () => {
    for (const argv of [["build"], [], ["toString"]]) {
      const { code, err } = await run(argv);
      expect(code).toBe(2);
      expect(err).toContain("check-architecture");
    }
    expect((await run(["build"])).err).toContain('unknown command "build"');
  });

  it("every command is a stub that exits 2 until its lane replaces it", async () => {
    for (const name of Object.keys(COMMANDS)) {
      const { code, err } = await run([name]);
      expect(code).toBe(2);
      expect(err).toBe(`vue-core ${name}: not implemented yet`);
    }
  });

  it("hands a command its arguments, its own config section and the config's folder", async () => {
    const dir = mkdtempSync(join(tmpdir, "cli-"));
    const file = join(dir, "x.config.mjs");
    writeFileSync(file, "export default { architecture: { features: 'features' } };");
    let seen;
    const load = async () => ({ default: (context) => { seen = context; return 3; } });
    const { code } = await run(["check-architecture", "--all", "--config", file, "src"], { cwd: tmpdir, load });
    expect(code).toBe(3);
    expect(seen).toMatchObject({ args: ["--all", "src"], config: { features: "features" }, root: dir, configPath: file });
  });

  it("a bad config exits 2 with the reason", async () => {
    const { code, err } = await run(["lint", "--config=missing.mjs"]);
    expect(code).toBe(2);
    expect(err).toContain("no such file");
  });
});
