// Fails when a class a component writes in a static class="..." is not a rule in dist/styles.css
// (a typo or a token name the theme lacks: Tailwind drops it silently and nothing is styled).
// Needs a fresh `npm run build`. Only static class="..." is read: the strings in a :class expression are mostly variant names, not classes.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync("dist/styles.css", "utf8");
const marks = new Set(["group", "peer", "tree-row", "tree-header", "form-row"]); // markers and test hooks: no rule of their own
const esc = (c) => c.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

const missing = new Map();
for (const file of walk("src").filter((f) => f.endsWith(".vue"))) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/(?<![\w:@#.-])class="([^"]*)"/g)) {
    const text = m[1];
    for (const c of text.split(/\s+/).filter((t) => /^[!a-z0-9[\-:_]/.test(t) && !t.includes("{{") && !t.includes("$"))) {
      if (marks.has(c) || css.includes(`.${esc(c)}`)) continue;
      (missing.get(c) ?? missing.set(c, []).get(c)).push(file);
    }
  }
}
for (const [c, files] of missing) console.error(`${c}  <- ${[...new Set(files)].join(", ")}`);
if (missing.size) { console.error(`\n${missing.size} class(es) with no rule in dist/styles.css`); process.exit(1); }
console.log("check-css-classes: every static class has a rule");
