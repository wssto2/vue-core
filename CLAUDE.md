# CLAUDE.md

`@wssto2/vue-core`: the shared Vue 3 library for go-core applications (app shell, list / record / form pages and their controls), extracted from arv-next's frontend. **[PLAN.md](PLAN.md) is the authority and its rules are binding**: phases, rules for every phase, the API design principles, and the progress table.

## Commands

```bash
npm run lint             # eslint + scripts/check-src-imports.mjs (src/ imports only src/ and the peers)
npm run typecheck        # vue-tsc --noEmit (strict, strictTemplates)
npm run test             # vitest run (happy-dom, @testing-library/vue, co-located src/**/*.test.ts)
npm run build            # vite lib build -> dist/*.js, dist/styles.css, then vue-tsc declarations -> dist/**/*.d.ts
npm run check:consumer   # npm pack -> install the tarball into playground/ -> vue-tsc + vite build + packed-output scan
npm run check            # all of the above in order: the gate, run once at the end of a phase
```

`check:consumer` needs a fresh `npm run build`. The playground installs the **packed tarball**, never a source alias; its `.pack/` and `node_modules/` are ignored by git.

## Layout

```
src/index.ts          public root (today: the version constant)
src/<area>/           one directory per area in PLAN.md "Layout"; public through a subpath in package.json "exports"
src/styles/           theme.css (tokens), base.css (variants, utilities, animations), fonts.css + fonts/, tailwind.css, index.css
playground/           consumer check (Vite + Vue + Tailwind, two brand accents)
scripts/              check-src-imports.mjs, check-consumer.mjs
vite.config.ts        JS entries (add one per subpath here) + vitest
vite.styles.config.ts dist/styles.css
```

Adding a subpath = an entry in `vite.config.ts`, an `exports` entry in `package.json`, and code behind it. No empty modules, no deep imports.

## Rules in brief (full text in PLAN.md)

- Start from arv-next's source, then make it right; arv-next (`/Users/josipzlimen/Projects/arv-next`) is read-only.
- No ARV knowledge: nothing from `@/…`, stores, `@/generated`, ARV global types, business wording. Needs come in as props, typed options or typed injection keys; a missing provider is a descriptive error.
- No service locator, no global mutable state, no import-time side effects.
- Peers (`vue`, `vue-router`, `vue-i18n`) are never bundled; `src/` has no path alias, only relative imports.
- Library strings live in `src/i18n/{en,hr,bs,sl}.json` under the `core` namespace.
- Styling is Tailwind v4 with the semantic tokens of `src/styles/theme.css`; the brand accent is the variables in its "Accent" block.
- One commit per step, conventional messages; the full gate once at the end of a phase; stop at the phase boundary.
