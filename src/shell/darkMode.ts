import { defineComponent, h, watch } from "vue";
import { defineFeature, type Feature } from "../app/feature";
import { usePreferences } from "../identity/usePreferences";
import { preferencesOf } from "../platform";
import DarkModeRow from "./DarkModeRow.vue";

/** The member of the person's stored preferences (`usePreferences`) that holds the mode. */
interface DarkModePreferences {
  dark_mode: boolean;
}

export interface DarkModeOptions {
  /** Whether this person wants dark mode now: read in a reactive context. Default: `dark_mode` of their stored preferences. */
  dark?: () => boolean;
  /** Stores the choice. It handles its own failure (a toast): the switch only flips what `dark()` says next. Default: saves `dark_mode` in their stored preferences. */
  set?: (dark: boolean) => void | Promise<void>;
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
 * The preference is `dark_mode` of the preferences go-core's identity module keeps for the person (`usePreferences`): the
 * switch shows at once and is saved with `PUT /v1/auth/preferences`; a refusal is a toast and the mode goes back.
 *
 *   darkMode()
 *
 * A preference kept elsewhere (a store, a cookie) is `dark` and `set`:
 *
 *   darkMode({ dark: () => store.dark, set: (dark) => store.save(dark) })
 *
 * The page follows `dark()` from the moment the application mounts, signed in or not (light while nobody is).
 */
export function darkMode(options: DarkModeOptions = {}): Feature {
  const row = defineComponent({
    name: "DarkModeSwitch",
    setup() {
      const preferences = usePreferences<DarkModePreferences>();
      const dark = options.dark ?? (() => preferences.value.value.dark_mode === true);
      const set = options.set ?? ((next: boolean) => void preferences.save({ dark_mode: next }));
      return () => h(DarkModeRow, { dark: dark(), onToggle: () => void set(!dark()) });
    },
  });
  return defineFeature({
    id: "vue-core.dark-mode",
    contributions: [{ id: "vue-core.dark-mode.row", slot: "accountMenu", component: row, scope: "authenticated" }],
    // Runs while the application is mounted, signed in or not; the watcher's stop handle is the effect's cleanup.
    effects: [{
      id: "vue-core.dark-mode",
      scope: "app",
      start: ({ platform }) => {
        const stored = preferencesOf<DarkModePreferences>(platform).value;
        return watch(options.dark ?? (() => stored.value.dark_mode === true), (dark) => applyDarkMode(dark, options.themeColor), { immediate: true });
      },
    }],
  });
}
