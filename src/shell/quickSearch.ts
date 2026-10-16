import { defineComponent, h, type Component } from "vue";
import { defineFeature, type Feature } from "../app/feature";
import QuickSearchButton from "./QuickSearchButton.vue";
import QuickSearchPalette from "./QuickSearchPalette.vue";
import type { QuickSearchOptions } from "./quickSearchControl";

/** The feature's pieces as components that carry the options, since a shell renders a contribution without props. */
function bound(options: QuickSearchOptions): Component {
  return defineComponent({ name: "QuickSearch", setup: () => () => h(QuickSearchPalette, options) });
}

/**
 * The quick search (Ctrl or ⌘ + K): one field that finds records from anywhere, as an opt-in feature.
 * It puts a search field in the shell's `search` slot (the sidebar, the phone drawer) and mounts the
 * palette once in the `host` slot; the shortcut is listed in the shortcut help.
 *
 *   createApplication({ platform, features: [identity, quickSearch({ search: (query, signal) => api.search(query, signal) })], shell: backofficeShell() })
 *
 * The app maps its server's answer to groups of rows and decides where a row goes (`to`). Typing is
 * debounced; an answer to an older query is dropped and the previous results stay until the new ones
 * arrive, so the list does not flicker. ↑ ↓ move, ↵ opens, Ctrl or ⌘ + ↵ opens in a new tab, Esc closes.
 */
export function quickSearch(options: QuickSearchOptions): Feature {
  return defineFeature({
    id: "vue-core.quick-search",
    contributions: [
      { id: "vue-core.quick-search.button", slot: "search", component: QuickSearchButton, scope: "authenticated", optional: true },
      { id: "vue-core.quick-search.palette", slot: "host", component: bound(options), scope: "authenticated" },
    ],
  });
}
