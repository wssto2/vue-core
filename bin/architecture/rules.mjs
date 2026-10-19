// The built-in rules `vue-core check-architecture` runs when the config has their section (`copy`, `routeAccess`). Unlike the packs
// they take options, and like the packs they have an `id`, a per-rule allowlist (`allow[<id>]`, a ratchet in both directions) and
// a `doc` reference. `check(source)` returns the text that follows the id in the report, or null.

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// `String.search` ignores a `g` flag's lastIndex, so a pattern given with one still gives the same answer on every line.
const matches = (pattern, text) => text.search(pattern) !== -1;

const literals = (code) => code.match(/(["'`])(?:\\.|(?!\1).)*\1/g) ?? [];
const codeWithoutComments = (code) =>
  code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/(^|[^:"'`\\])\/\/.*$/, "$1"))
    .join("\n");
const withoutComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const COPY_ATTRIBUTE = /(?<![\w-])(:|v-bind:)?(placeholder|title|aria-label|label)="([^"]*)"/g;

/** The literals a user can read in a source file: a `.vue` file's `<script>` strings and its template's copy attributes (a bound one by its quoted parts). */
function copyLiterals(content, isVue) {
  const scripts = isVue ? [...content.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]) : [content];
  const found = scripts.flatMap((script) => literals(codeWithoutComments(script)));
  if (isVue) {
    const template = (content.match(/<template>([\s\S]*)<\/template>/)?.[1] ?? "").replace(/<!--[\s\S]*?-->/g, "");
    for (const [, bound, , value] of template.matchAll(COPY_ATTRIBUTE)) found.push(...(bound ? literals(value) : [value]));
  }
  return found;
}

/**
 * no-hardcoded-copy: the first line of user-facing text that `pattern` (a language's letters or words) matches. Everywhere that is a
 * `.vue` template's text nodes and the quoted strings of `form.ts`, `*Form.ts` and files under a `forms/` folder; inside `scope`
 * (default the UI folders) also every string literal of a `.ts` or `<script>` and a template's placeholder / title / aria-label / label.
 * `properNames` is cut out of what `scope` scans (brand names that use the language's letters). A test is never scanned.
 */
function noHardcodedCopy({ pattern, scope, properNames }) {
  return ({ file, content, isVue, isTest }) => {
    if (isTest) return null;
    let scanText = null;
    if (isVue) {
      const tpl = content.match(/<template>([\s\S]*)<\/template>/);
      if (tpl) scanText = tpl[1].replace(/<!--[\s\S]*?-->/g, "").replace(/\{\{[\s\S]*?\}\}/g, "").replace(/<[^>]+>/g, "\n");
    } else if (file.endsWith(".ts")) {
      const segments = file.split("/");
      const base = segments[segments.length - 1];
      if (base === "form.ts" || /Form\.ts$/.test(base) || segments.includes("forms")) {
        const noComments = content
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .split("\n")
          .filter((line) => !/^\s*\/\//.test(line))
          .join("\n");
        scanText = literals(noComments).join("\n");
      }
    }
    if (matches(scope, file)) {
      scanText = [scanText ?? "", ...copyLiterals(content, isVue)].join("\n");
      if (properNames) scanText = scanText.replace(properNames, "");
    }
    const hit = scanText
      ?.split("\n")
      .map((line) => line.trim())
      .find((line) => line.length >= 3 && matches(pattern, line));
    return hit ? `hardcoded copy in a user-facing string (“${hit.slice(0, 60)}”) — move it to an i18n key` : null;
  };
}

/**
 * no-route-policy: a route names its permission in `meta.permission`; `policy:` / `requires:` in a `routes.ts` and the session's
 * old list (`authStore.<sessionField>`, `state.<sessionField>`) are the model it replaced. Comments, tests and `exclude`d files are not scanned.
 */
function noRoutePolicy({ sessionField, exclude }) {
  const oldList = sessionField ? new RegExp(`\\b(?:authStore|state)\\.${escape(sessionField)}\\b`) : null;
  return ({ file, content, isTest }) => {
    if (isTest || (exclude && matches(exclude, file))) return null;
    const isRouteFile = /(^|\/)routes\.ts$/.test(file);
    const hit = withoutComments(content)
      .split("\n")
      .find((line) => (isRouteFile && /^\s*(policy|requires)\s*:/.test(line)) || (oldList && oldList.test(line)));
    return hit ? `“${hit.trim().slice(0, 80)}” — a route needs \`meta.permission\` (a catalogued permission, or an array of them)${sessionField ? `, and the session holds \`access\`, not a \`${sessionField}\` list` : ""}` : null;
  };
}

export const RULE_IDS = ["no-hardcoded-copy", "no-route-policy"];

/** The rules the config switches on, each `{ id, check, seen }` (`seen`: the allowlisted files that tripped it). */
export function builtInRules(config) {
  const rules = [];
  if (config.copy) {
    const scope = config.copy.scope ?? new RegExp(`^(?:${config.uiDirs.map(escape).join("|")})/`);
    rules.push({ id: "no-hardcoded-copy", check: noHardcodedCopy({ ...config.copy, scope }) });
  }
  if (config.routeAccess) rules.push({ id: "no-route-policy", check: noRoutePolicy(config.routeAccess) });
  return rules.map((rule) => ({ ...rule, seen: new Set() }));
}
