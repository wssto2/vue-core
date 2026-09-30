// Fails when src/ imports anything but files inside src/ and the declared peers
// (PLAN.md rules 3-5): no `@/` alias, no pinia or app stores, no undeclared package,
// no relative path that leaves src/. Run by `npm run lint`.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const allowed = [...Object.keys(pkg.peerDependencies ?? {}), ...Object.keys(pkg.dependencies ?? {})];

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (/\.(ts|vue|css)$/.test(entry.name)) yield path;
  }
}

// import x from "y" | import "y" | export … from "y" | import("y") | CSS @import "y"
const specifier = /(?:\bfrom\s*|\bimport\s*\(?\s*|@import\s+(?:url\()?\s*)["']([^"']+)["']/g;

const problems = [];
for (const file of files(src)) {
  const isTest = /\.test\.ts$/.test(file); // tests are not shipped: they may reach package.json and Node built-ins
  const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, ""); // comments may show example imports
  for (const [, spec] of code.matchAll(specifier)) {
    const where = `${relative(root, file)}: "${spec}"`;
    if (spec.startsWith(".")) {
      const target = resolve(dirname(file), spec);
      if (!isTest && target !== src && !target.startsWith(src + sep)) problems.push(`${where} leaves src/`);
    } else if (spec === "tailwindcss" && file.endsWith(".css")) {
      // the stylesheet entry imports Tailwind itself (a devDependency, bundled into dist/styles.css)
    } else if (isTest && (spec.startsWith("node:") || spec === "vitest" || spec === "@testing-library/vue")) {
      // tests
    } else if (!allowed.some((name) => spec === name || spec.startsWith(`${name}/`))) {
      problems.push(`${where} is not a peer or dependency`);
    }
  }
}

if (problems.length > 0) {
  console.error(`src/ import boundary violated:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("src/ imports: only src/ and declared peers");
