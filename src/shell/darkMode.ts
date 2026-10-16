import { defineComponent, h, watch } from "vue";
import { defineFeature, type Feature } from "../app/feature";
import DarkModeRow from "./DarkModeRow.vue";

export interface DarkModeOptions {
  /** Whether this person wants dark mode now: read in a reactive context (their session user's preference, a store). */
  dark: () => boolean;
  /** Stores the choice. It handles its own failure (a toast): the switch only flips what `dark()` says next. */
  set: (dark: boolean) => void | Promise<void>;
  /** The colour of an installed app's status bar, which follows the mode. Default white and `#18181B`. */
  themeColor?: { light: string; dark: string };
}

const DEFAULT_THEME_COLOR = { light: "#ffffff", dark: "#18181B" };

/** Puts the mode on the page: the `dark` class the theme's tokens switch on, and the status bar colour (`<meta name="theme-color">`) when the page has one. */
export function applyDarkMode(dark: boolean, themeColor = DEFAULT_THEME_COLOR): void {
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? themeColor.dark : themeColor.light);
}

/**
 * The person's dark-mode preference, as an opt-in feature: a switch in the account menu and the mode on the page.
 * Where the preference lives is the app's (usually a field of the session user, saved on the server):
 *
 *   darkMode({ dark: () => session.user.value?.preferences.dark_mode ?? false, set: (dark) => savePreferences({ dark_mode: dark }) })
 *
 * The page follows `dark()` from the moment the application mounts, signed in or not.
 */
export function darkMode(options: DarkModeOptions): Feature {
  const row = defineComponent({
    name: "DarkModeSwitch",
    setup: () => () => h(DarkModeRow, { dark: options.dark(), onToggle: () => void options.set(!options.dark()) }),
  });
  return defineFeature({
    id: "vue-core.dark-mode",
    contributions: [{ id: "vue-core.dark-mode.row", slot: "accountMenu", component: row, scope: "authenticated" }],
    // Runs while the application is mounted, signed in or not; the watcher's stop handle is the effect's cleanup.
    effects: [{ id: "vue-core.dark-mode", scope: "app", start: () => watch(options.dark, (dark) => applyDarkMode(dark, options.themeColor), { immediate: true }) }],
  });
}
