import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError, DEFAULTS, findConfig, loadConfig } from "./config.mjs";

// Vite (which runs the tests) cannot import a file outside the project, so the temporary configs live in node_modules.
const tmpdir = join(process.cwd(), "node_modules", ".cache");
mkdirSync(tmpdir, { recursive: true });
const folder = () => mkdtempSync(join(tmpdir, "config-"));
const write = (dir, source, name = "vue-core.config.mjs") => {
  const file = join(dir, name);
  writeFileSync(file, source);
  return file;
};

describe("loadConfig", () => {
  it("without a file gives every section's defaults and the cwd as root", async () => {
    const dir = folder();
    const loaded = await loadConfig({ cwd: dir });
    expect(loaded).toEqual({ path: null, root: dir, config: { lint: {}, architecture: DEFAULTS.architecture, generator: {}, e2eTimings: {} } });
  });

  it("finds the file from a nested folder and fills the sections it leaves out", async () => {
    const dir = folder();
    const file = write(dir, "export default { lint: { files: ['src'] } };");
    const nested = join(dir, "a", "b");
    mkdirSync(nested, { recursive: true });
    expect(findConfig(nested)).toBe(file);
    const loaded = await loadConfig({ cwd: nested });
    expect(loaded.root).toBe(dir);
    expect(loaded.config).toEqual({ lint: { files: ["src"] }, architecture: DEFAULTS.architecture, generator: {}, e2eTimings: {} });
  });

  it("--config names the file, relative to the cwd", async () => {
    const dir = folder();
    write(dir, "export default { generator: { name: 'x' } };", "other.config.mjs");
    const loaded = await loadConfig({ cwd: dir, path: "other.config.mjs" });
    expect(loaded.config.generator).toEqual({ name: "x" });
  });

  it("refuses a missing --config file, an unknown section, a section that is not an object and a file with no default", async () => {
    await expect(loadConfig({ cwd: folder(), path: "nope.mjs" })).rejects.toThrow(/no such file/);
    const refuses = async (source, reason) => {
      const dir = folder(); // one folder per case: the module loader caches a path
      write(dir, source);
      await expect(loadConfig({ cwd: dir })).rejects.toThrow(reason);
    };
    await refuses("export default { linting: {} };", /unknown section linting; the sections are lint, architecture, generator, e2eTimings/);
    await refuses("export default { lint: [] };", /"lint" must be an object/);
    await refuses("export const lint = {};", ConfigError);
  });
});
