// permission-texts: the permissions the generated catalogue lists and the texts the locale files keep for them agree. Every id has each key
// in each locale, and no locale keeps a key for an id that is gone. A key template is `<namespace>.<prefix>{id}`: the namespace is the folder
// `<dir>/<namespace>/<locale>.json`, and the file is nested by dots (`"crm": { "lead:view": "…" }` holds `crm.lead:view`).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** The ids of a generated permissions file: its quoted strings (`export type Permission = 'a:view' | 'b:view'`), comments cut out. */
export function generatedIds(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  return [...new Set([...code.matchAll(/(["'`])([^"'`\n]+)\1/g)].map((match) => match[2]))];
}

// A nested messages file as the identifiers it holds: a leaf string is named by the dotted path to it.
function flatten(node, prefix, out) {
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string") out.add(prefix + key);
    else if (value && typeof value === "object") flatten(value, `${prefix}${key}.`, out);
  }
}

/** The violations of `permission-texts`, as messages that start with the file they concern. */
export function checkPermissionTexts({ root, config: { generated, keys, locales, dir = "i18n" } }) {
  const generatedFile = path.join(root, generated);
  if (!existsSync(generatedFile)) return [`${generated}: permission-texts — the generated permissions file does not exist.`];
  const ids = generatedIds(readFileSync(generatedFile, "utf8"));
  const known = new Set(ids);
  const violations = [];
  for (const locale of locales) {
    for (const key of keys) {
      const [namespace, ...rest] = key.split(".");
      const prefix = rest.join(".").replace("{id}", "");
      const file = `${dir}/${namespace}/${locale}.json`;
      if (!existsSync(path.join(root, file))) {
        violations.push(`${file}: permission-texts — the file does not exist.`);
        continue;
      }
      let messages;
      try {
        messages = JSON.parse(readFileSync(path.join(root, file), "utf8"));
      } catch (error) {
        violations.push(`${file}: permission-texts — not valid JSON (${error.message}).`);
        continue;
      }
      const have = new Set();
      flatten(messages, "", have);
      for (const id of ids) if (!have.has(prefix + id)) violations.push(`${file}: permission-texts — ${id} has no text (${key.replace("{id}", id)}).`);
      for (const name of [...have].sort()) {
        if (name.startsWith(prefix) && !known.has(name.slice(prefix.length))) violations.push(`${file}: permission-texts — ${name.slice(prefix.length)} is not in ${generated}; remove its text.`);
      }
    }
  }
  return violations;
}
