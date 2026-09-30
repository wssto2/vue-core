// Consumer check (PLAN.md V1): packs the library, installs the tarball into playground/
// (never a source alias), typechecks and builds the playground against it, and verifies
// the packed output is clean. Needs `npm run build` first (the tarball ships dist/).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const playground = join(root, "playground");
const packDir = join(playground, ".pack");
const installed = join(playground, "node_modules", "@wssto2", "vue-core");

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: "inherit" });
const fail = (message) => {
  console.error(`check:consumer FAILED: ${message}`);
  process.exit(1);
};
const step = (message) => console.log(`\n== ${message}`);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

if (!existsSync(join(root, "dist", "index.js"))) fail("dist/ is missing: run `npm run build` first");

step("pack");
rmSync(packDir, { recursive: true, force: true });
mkdirSync(packDir, { recursive: true });
const [packed] = JSON.parse(
  execFileSync("npm", ["pack", "--json", "--pack-destination", packDir], { cwd: root, encoding: "utf8" }),
);
renameSync(join(packDir, packed.filename), join(packDir, "vue-core.tgz"));
const shipped = packed.files.map((file) => file.path);
const stray = shipped.filter((path) => !/^(dist\/|src\/styles\/|package\.json$)/.test(path));
if (stray.length > 0) fail(`tarball ships files outside dist/ and src/styles/: ${stray.join(", ")}`);
if (shipped.some((path) => /\.test\.|^src\/(?!styles\/)/.test(path))) fail("tarball ships sources or tests");
console.log(`${shipped.length} files, ${(packed.size / 1024).toFixed(0)} kB packed`);

step("install the tarball into the playground");
rmSync(installed, { recursive: true, force: true }); // npm must not reuse an older tarball
run("npm", ["install", "--no-audit", "--no-fund", "--no-package-lock"], playground);

step("one Vue runtime in the consumer");
for (const name of ["vue", "vue-router", "vue-i18n"]) {
  const copies = [...walk(join(playground, "node_modules"))]
    .filter((file) => file.endsWith(`${join("node_modules", name, "package.json")}`))
    .map((file) => relative(playground, file));
  if (copies.length !== 1) fail(`${name} is installed ${copies.length} times: ${copies.join(", ")}`);
}
if (existsSync(join(installed, "node_modules"))) fail("the installed package carries its own node_modules");
console.log("vue, vue-router and vue-i18n: one copy each, none nested in the package");

step("subpaths resolve in Node and share one ApiError class");
// Imports through the package name from inside the playground: the exports map, the shared chunk
// and the peers all have to work for a consumer, not just exist on disk.
run(
  "node",
  [
    "--input-type=module",
    "-e",
    `
    import { ApiError, createHttpClient } from "@wssto2/vue-core/client";
    import { createPlatform, parseSessionPayload } from "@wssto2/vue-core/platform";
    let thrown;
    try { parseSessionPayload("x"); } catch (error) { thrown = error; }
    if (!(thrown instanceof ApiError)) throw new Error("the platform subpath throws its own ApiError class, not the client subpath's");
    const platform = createPlatform({ config: { apiBase: "", locale: "en", appName: null, capabilities: [] }, transport: async () => { throw new Error("no requests at construction"); } });
    if (typeof createHttpClient !== "function" || platform.session.state.value.status !== "unknown") throw new Error("platform did not build");
    console.log("client and platform subpaths import; ApiError is one class");
    `,
  ],
  playground,
);

step("packed output is free of app knowledge");
const pkg = JSON.parse(readFileSync(join(installed, "package.json"), "utf8"));
const forbidden = [
  { pattern: /["']@\//, what: "an `@/` import" },
  { pattern: /\b(IconKey|MessageSchema|UserResponse|AccentKey)\b/, what: "an ARV global type name" },
  { pattern: /\bRoute\b/, what: "the ARV global `Route` type" },
  { pattern: /from\s*["']pinia["']/, what: "a pinia import" },
];
let scanned = 0;
for (const file of walk(join(installed, "dist"))) {
  if (!/\.(js|d\.ts|css)$/.test(file)) continue;
  scanned++;
  const code = readFileSync(file, "utf8");
  for (const { pattern, what } of forbidden) {
    if (pattern.test(code)) fail(`${relative(installed, file)} contains ${what}`);
  }
}
console.log(`${scanned} emitted files scanned`);

step("exports resolve inside the installed package");
const targets = [];
const collect = (value) => {
  if (typeof value === "string") targets.push(value);
  else if (value && typeof value === "object") Object.values(value).forEach(collect);
};
collect(pkg.exports);
for (const target of targets) if (!existsSync(join(installed, target))) fail(`exports target ${target} is missing`);
const stylesheet = readFileSync(join(installed, "dist", "styles.css"), "utf8");
for (const [, url] of stylesheet.matchAll(/url\(([^)]+)\)/g)) {
  const path = url.replace(/["']/g, "");
  if (!path.startsWith("./")) fail(`styles.css has a non-relative url(${path})`);
  if (!existsSync(join(installed, "dist", path))) fail(`styles.css references a missing file ${path}`);
}
console.log(`${targets.length} export targets and the font urls of styles.css exist`);

step("playground: typecheck and production build");
run("npx", ["vue-tsc", "--noEmit"], playground);
rmSync(join(playground, "dist"), { recursive: true, force: true });
run("npx", ["vite", "build"], playground);
const built = [...walk(join(playground, "dist"))].map((file) => relative(join(playground, "dist"), file));
if (!built.some((file) => file.endsWith(".woff2"))) fail("the playground build contains no font asset");
if (!built.includes("prebuilt.html")) fail("the playground build lacks the prebuilt-stylesheet page");
const css = built.filter((file) => file.endsWith(".css")).map((file) => readFileSync(join(playground, "dist", file), "utf8")).join("\n");
for (const token of ["--app-tint", "--color-tile-brand", "bg-surface-cell", "rounded-button"]) {
  if (!css.includes(token)) fail(`built CSS lacks ${token}`);
}
if (!css.includes("#6d28d9")) fail("built CSS lacks the second accent (violet)");

console.log("\ncheck:consumer passed");
