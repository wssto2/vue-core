# Recipe: theming

The look is **Emerald Native**: Apple-style grouped structure with a brand accent, light and dark. It is Tailwind v4 through semantic tokens; there is no second styling system to learn, and no component takes a color.

## Set it up once

<!-- example: docs/examples/app/styles.css -->
```css
@import "tailwindcss";
@import "@wssto2/vue-core/tailwind.css";
@import "@wssto2/vue-core/fonts.css";
@import "./brand.css";
```

`tailwind.css` brings the tokens, the variants (`dark:`, `compact:`) and the utilities the components use (it `@source`s the package's build); `fonts.css` brings Inter and JetBrains Mono, self-hosted. An application that writes no Tailwind of its own imports `@wssto2/vue-core/styles.css` once instead: the same design, prebuilt.

## Brand accent

The accent is the variables in the "Accent" block of `src/styles/theme.css` (`--app-tint`, `--app-tint-soft`, `--app-control-on`, the tiles), plus the `--color-primary-*` and `--color-anchor-*` palettes. Redefine them after the import: light on `:root`, dark on `.dark`. Links, the focus ring, selection and the sidebar are derived from them. **Status colors (success, warning, danger, info) never follow the brand**: a warning stays amber in any accent.

<!-- example: docs/examples/app/brand.css -->
```css
/* The brand accent: the palettes and the "Accent" variables of the library's theme.css, redefined
   after it (light on :root, dark on .dark). Status colours never follow the brand. */
:root {
  --color-primary-50: #EFF6FF;
  --color-primary-100: #DBEAFE;
  --color-primary-200: #BFDBFE;
  --color-primary-300: #93C5FD;
  --color-primary-400: #60A5FA;
  --color-primary-500: #3B82F6;
  --color-primary-600: #2563EB;
  --color-primary-700: #1D4ED8;
  --color-primary-800: #1E40AF;
  --color-primary-900: #1E3A8A;
  --color-primary-950: #172554;
  --color-anchor-800: #1B2A4A;
  --color-anchor-900: #111C33;
  --color-anchor-950: #0A1222;

  --app-tint: #1D4ED8;
  --app-tint-soft: #E8EFFD;
  --app-control-on: #2563EB;
  --app-tile-brand: #2563EB;
  --app-tile-anchor: #1B2A4A;
  --app-tile-anchor-foreground: #93C5FD;
  --app-content-inverse-accent: #93C5FD;
}

.dark {
  --app-tint: #60A5FA;
  --app-tint-soft: #1B2A4A;
  --app-control-on: #3B82F6;
  --app-content-on-tint: #0A1222;
  --app-tile-anchor: #22335C;
  --app-content-inverse-accent: #1D4ED8;
}
```

To switch accents at run time (per tenant, per user), scope the same variables under an attribute (`:root[data-accent="violet"]`, and `:root[data-accent="violet"].dark`) and set it on `<html>`. The playground does this: `playground/src/accents.css`.

## Dark mode

Dark mode is the `dark` class on `<html>`: `document.documentElement.classList.toggle("dark", on)`. The library decides nothing (follow the system, a stored choice, a user setting are yours); the account-menu switch in the [shell recipe](shell.md) is one way. The page background and text colors come from the `body` classes you set (`bg-surface-page text-content`).

## Use the tokens in your own markup

Write your features with the same roles and they follow the theme in both modes and any accent:

| Role | Examples |
|---|---|
| Surfaces | `bg-surface-page`, `bg-surface-cell`, `bg-surface-raised`, `bg-fill` |
| Content | `text-content`, `text-content-strong`, `text-content-muted`, `text-content-destructive`, `text-content-link` |
| Type | `text-large-title`, `text-headline`, `text-body`, `text-footnote` (they grow to iOS sizes on phones) |
| Status | `bg-status-warning-surface text-status-warning-content`, and likewise `success`, `danger`, `info`, `neutral` |
| Category | `bg-category-violet-surface text-category-violet-content`, and likewise the other hues of `Badge` |
| Shape and spacing | `rounded-group`, `rounded-control`, `gap-section-gap`, `gap-group-gap` |
| Variants | `dark:`, `compact:` (phones and touch-first screens) |

Do not hard-code palette colors (`bg-gray-100`) or add a parallel system next to this one: extend the theme (`@theme inline`, `@custom-variant`) instead. Components take *meaning*, never pixels or colors: `tone="critical"`, `prominence="primary"`, `role="destructive"`.

## Statuses and categories

A `Badge` says one of two things. **A state** is a `tone` (`neutral`, `info`, `positive`, `warning`, `critical`, or `context` for information that is not a state): red, green, orange and sky blue belong to these and mean something. **A kind** is a `hue`: nine colours (`amber`, `lime`, `teal`, `cyan`, `blue`, `indigo`, `violet`, `fuchsia`, `pink`) for telling things apart, such as where a lead came from. A hue never reuses a status colour, so a category cannot be mistaken for a warning. The label always shows; colour is never the only carrier.

<!-- example: docs/examples/app/Sources.vue -->
```vue
<script setup lang="ts">
import { Badge, type Hue } from "@wssto2/vue-core/state";

defineProps<{ source: string }>();

// Your categories map to hues in one place. A hue says "of this kind", never "in this state": statuses keep `tone`.
const HUE_OF_SOURCE: Record<string, Hue> = { instagram: "violet", facebook: "blue", referral: "teal", website: "cyan", fair: "amber" };
</script>

<template>
  <div class="flex items-center gap-2">
    <!-- Tinted: the label in the hue on its tint. -->
    <Badge :hue="HUE_OF_SOURCE[source] ?? 'indigo'">{{ source }}</Badge>
    <!-- Dot: a neutral label with the hue as a dot, quieter in a dense table. -->
    <Badge :hue="HUE_OF_SOURCE[source] ?? 'indigo'" appearance="dot">{{ source }}</Badge>
    <!-- A state next to it keeps its own colours. -->
    <Badge tone="positive" dot>Active</Badge>
  </div>
</template>
```

Every hue has `category-<hue>-content` and `category-<hue>-surface` roles in the theme, in light and dark, with a text contrast of at least 5:1 on the tint (AA asks 4.5:1; `src/state/categoryHues.test.ts` checks the shipped values). Use them in your own markup like the status roles: `bg-category-teal-surface text-category-teal-content`. The hues are not part of the brand accent and do not change with it. Map your categories to hues in one place, as the example does.

## Motion

Durations are tokens (`--app-motion-*`) and reduced motion sets them to zero: nothing to do per component. Waiting is said in words where it happens (a button's spinner, a status line that follows a long operation), never a blocking overlay.
