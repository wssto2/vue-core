// The `vue-core` dispatcher: `vue-core <command> [options]`. A command is bin/commands/<name>.mjs whose default export is
// `async (context) => exitCode | void`, where context = { args, config, root, configPath, cwd, out, err } and `config` is that
// command's own section of vue-core.config.mjs (defaults applied).
import { ConfigError, loadConfig } from "./config.mjs";

/** command name -> its section in the config, and the line `--help` shows */
export const COMMANDS = {
  lint: { section: "lint", summary: "ESLint with per-file ceilings that only go down" },
  "check-architecture": { section: "architecture", summary: "feature-folder import and layer rules" },
  feature: { section: "generator", summary: "scaffold a CRUD feature folder" },
  "e2e-timings": { section: "e2eTimings", summary: "the slowest specs of a Playwright JSON report" },
};

const usage = () =>
  [
    "Usage: vue-core [--config <path>] <command> [options]",
    "",
    "Commands:",
    ...Object.entries(COMMANDS).map(([name, { summary }]) => `  ${name.padEnd(20)}${summary}`),
    "",
    "Options are read from vue-core.config.mjs, found from the current folder upwards (or --config <path>).",
  ].join("\n");

/** Takes `--config <path>` / `--config=<path>` out of `argv`, wherever it stands. */
function takeConfigFlag(argv) {
  const rest = [];
  let path;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--config") path = argv[++i];
    else if (argv[i].startsWith("--config=")) path = argv[i].slice("--config=".length);
    else rest.push(argv[i]);
  }
  return { path, rest };
}

/** @returns {Promise<number>} the exit code */
export async function main(argv, { cwd = process.cwd(), out = console.log, err = console.error, load = (name) => import(`./commands/${name}.mjs`) } = {}) {
  const { path, rest } = takeConfigFlag(argv);
  const [name, ...args] = rest;
  if (name === "--help" || name === "-h" || name === "help") {
    out(usage());
    return 0;
  }
  if (!name || !Object.hasOwn(COMMANDS, name)) {
    err(name ? `vue-core: unknown command "${name}"\n\n${usage()}` : usage());
    return 2;
  }
  try {
    const { config, root, path: configPath } = await loadConfig({ cwd, path });
    const command = await load(name);
    return (await command.default({ args, config: config[COMMANDS[name].section], root, configPath, cwd, out, err })) ?? 0;
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    err(`vue-core: ${error.message}`);
    return 2;
  }
}
