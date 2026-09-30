// The documentation's code is real code: every ts / vue / css / json block in README.md and docs/recipes/
// must be marked with the file it comes from and equal that file in docs/examples/ (whole, or the lines
// `path:first-last`). The examples are typechecked by `npm run typecheck:docs`, so a snippet that
// compiles today cannot rot. Shell, html and plain-text blocks are free. Run by `npm run check`.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const documents = ["README.md", ...readdirSync(join(root, "docs", "recipes")).filter((name) => name.endsWith(".md")).map((name) => `docs/recipes/${name}`)];
const checked = new Set(["ts", "vue", "css", "json"]);

const problems = [];
let blocks = 0;
for (const document of documents) {
  const lines = readFileSync(join(root, document), "utf8").split("\n");
  for (let index = 0; index < lines.length; index++) {
    const open = /^```(\w+)\s*$/.exec(lines[index]);
    if (!open) continue;
    const end = lines.indexOf("```", index + 1);
    const body = lines.slice(index + 1, end);
    const at = `${document}:${index + 1}`;
    const marker = /^<!-- example: (\S+?)(?::(\d+)-(\d+))? -->$/.exec(lines[index - 1] ?? "");
    if (checked.has(open[1]) && !marker) problems.push(`${at}: a ${open[1]} block must be preceded by <!-- example: docs/examples/… -->`);
    if (marker) {
      const file = join(root, marker[1]);
      if (!marker[1].startsWith("docs/examples/") || !existsSync(file)) problems.push(`${at}: ${marker[1]} is not a file under docs/examples/`);
      else {
        const source = readFileSync(file, "utf8").replace(/\n$/, "").split("\n");
        const expected = marker[2] ? source.slice(Number(marker[2]) - 1, Number(marker[3])) : source;
        blocks++;
        if (expected.join("\n") !== body.join("\n")) problems.push(`${at}: differs from ${marker[1]}${marker[2] ? `:${marker[2]}-${marker[3]}` : ""}; paste the file's text`);
      }
    }
    index = end;
  }
}

if (problems.length > 0) {
  console.error(`check:docs FAILED\n${problems.map((problem) => `  ${problem}`).join("\n")}`);
  process.exit(1);
}
console.log(`check:docs: ${blocks} code blocks in ${documents.length} documents equal their examples (${relative(root, join(root, "docs/examples"))}/)`);
