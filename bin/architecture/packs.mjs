// The rule packs `vue-core check-architecture` ships, opt in by name (`packs: ["design-values", "presentation"]`):
// "design-values" keeps the look in vue-core's theme (colours, type weights, shadows), "presentation" asks for the library's
// components instead of hand-built markup. A pack's rule has an `id`, a `hint` and `test(content, template, classLists)`;
// the engine reports `<file>: <id> — <hint>.` and keeps the pack's per-rule allowlist (`allow[<id>]`) a ratchet in both
// directions: an entry that no longer trips its rule is a violation too.

const UTIL = "(?:bg|text|border|border-[trblxy]|ring|ring-offset|divide|fill|stroke|outline|decoration|from|via|to|placeholder|caret|accent|shadow)";

const pattern = (id, hint, regex) => ({ id, hint, test: (content) => regex.test(content) });

// The shared field components' opening tags in a template that renders FormGroups,
// keeping only those that bind their own `editable` (rule no-field-editable-in-group).
function fieldTagsWithEditable(template) {
  if (!/<(?:FormGroup|form-group)[\s>]/.test(template)) return [];
  const names = "(?:text|textarea|select|combo|date|date-time|month-year|switch|segmented-select)-field|(?:Text|Textarea|Select|Combo|Date|DateTime|MonthYear|Switch|SegmentedSelect)Field|choice-chips|ChoiceChips";
  const found = [];
  for (const match of template.matchAll(new RegExp(`<(${names})(?=[\\s/>])`, "g"))) {
    let end = match.index + match[0].length;
    let quote = null;
    for (; end < template.length; end += 1) {
      const char = template[end];
      if (quote) { if (char === quote) quote = null; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === ">") break;
    }
    const tag = template.slice(match.index, end);
    if (/(?<![\w-])(?::|v-bind:)?editable=/.test(tag)) found.push(tag);
  }
  return found;
}

export const PACKS = {
  "design-values": {
    // .vue / .ts of the UI folders, tests excluded
    applies: ({ file, uiDirs }) => uiDirs.some((dir) => file.startsWith(`${dir}/`)) && /\.(vue|ts)$/.test(file) && !/(^|\/)tests\/|\.test\.ts$|\.spec\.ts$/.test(file),
    rules: [
      pattern("no-stray-neutral", "neutral / zinc / slate / stone colour — the one neutral is gray (vue-core theme.css)", new RegExp(`(?<![\\w-])(?:[\\w-]+:)*${UTIL}-(?:neutral|zinc|slate|stone)-\\d{2,3}(?![\\w-])`)),
      pattern("no-raw-brand-hue", "green / emerald colour — the brand green is primary-* (a stepper tick, switch, success or active state)", new RegExp(`(?<![\\w-])(?:[\\w-]+:)*${UTIL}-(?:green|emerald)-\\d{2,3}(?![\\w-])`)),
      pattern("no-unbranded-focus", "blue / sky / cyan / indigo focus colour — focus rings and borders are primary-* everywhere (decorative rings are fine)", /(?<![\w-])(?:[\w-]+:)*(?:focus|focus-within|focus-visible|peer-focus|checked)(?::[\w-]+)*:(?:ring|border|outline)-(?:blue|sky|cyan|indigo)-\d{2,3}/),
      pattern("no-unloaded-font-weight", "font-bold / extrabold / black — the type scale stops at semibold until decision D9; use font-semibold", /(?<![\w-])(?:[\w-]+:)*font-(?:bold|extrabold|black)(?![\w-])/),
      pattern("no-arbitrary-design-value", "arbitrary shadow / radius / hex colour — add the value to vue-core theme.css and use its utility", /(?<![\w-])(?:[\w-]+:)*(?:shadow-\[[^\]]+\]|rounded(?:-[trblse]{1,2})?-\[[^\]]+\]|(?:bg|text|border|ring|fill|stroke)-\[#[0-9a-fA-F]{3,8}\])/),
    ],
  },
  presentation: {
    // the .vue files of the features folder
    applies: ({ file, isVue, featuresDir }) => isVue && file.startsWith(`${featuresDir}/`),
    rules: [
      {
        id: "no-field-editable-in-group",
        hint: "a shared field with its own `editable` in a grouped form — put read mode on the FormGroup / ResourceForm (`:editable`) and lock a single value with `disabled`",
        test: (_content, template) => fieldTagsWithEditable(template).length > 0,
      },
      {
        id: "no-adhoc-alert",
        // a class list with an un-prefixed (optionally dark:) bg-{red|amber|green|emerald|blue|orange}-{50|100}, a rounded* and a p*- token
        hint: "coloured alert box — use <Banner type=…> instead of a bg-*-50 rounded p-* div",
        test: (_content, _template, classLists) =>
          classLists.some((toks) => {
            const bg = toks.some((t) => /^(?:dark:)?bg-(?:red|amber|green|emerald|blue|orange)-(?:50|100)(?:\/\d+)?$/.test(t));
            const rounded = toks.some((t) => /^rounded(-.+)?$/.test(t));
            const pad = toks.some((t) => /^p[xytblr]?-/.test(t));
            return bg && rounded && pad;
          }),
      },
      {
        id: "no-raw-table",
        hint: "raw <table> — use <DataTable> (child collections) or <collection-table> (paginated lists)",
        test: (content) => /<table[\s>]/.test(content),
      },
      {
        id: "no-raw-form-control",
        hint: "raw <input>/<select>/<textarea>/<label> in a feature .vue — use the field components",
        test: (_content, template) => /<(input|select|textarea|label)(\s|>|\/)/.test(template),
      },
      {
        id: "no-arbitrary-type-scale",
        hint: "arbitrary text-[N px|rem] or font-[N] — use the type scale (text-2xs…text-3xl, font-medium/semibold; vue-core theme.css)",
        test: (content) => /text-\[\d*\.?\d+(?:px|rem|em)\]|font-\[\d{3}\]/.test(content),
      },
      {
        id: "no-bare-loading-text",
        hint: "the word “Loading” rendered directly — render <AsyncSection>'s skeleton instead",
        test: (_content, template) => /general\.loading/.test(template),
      },
      {
        // a class list with `uppercase`, a micro text size, `rounded*` and `px-*` (a hand-built pill; .label-micro / <MicroLabel> is a label)
        id: "no-adhoc-badge",
        hint: "hand-built uppercase badge — use <Badge tone=…> (@wssto2/vue-core/state)",
        test: (_content, _template, classLists) =>
          classLists.some(
            (toks) =>
              toks.includes("uppercase") &&
              toks.some((t) => /^text-(?:3xs|2xs)$/.test(t)) &&
              toks.some((t) => /^rounded(-.+)?$/.test(t)) &&
              toks.some((t) => /^px-/.test(t)),
          ),
      },
      {
        // columns built in a separate .ts must still carry the role in the view
        id: "collection-table-roles",
        hint: "CollectionTable without column `mobile` roles (or with the retired #mobile-row slot) — give the columns primary / accessory / meta roles",
        test: (content, template) =>
          (/<(?:collection-table|CollectionTable)[\s>/]/.test(template) && !/\bmobile:\s*["']/.test(content)) || /(?:#|v-slot:)mobile-row\b/.test(template),
      },
    ],
  },
};
