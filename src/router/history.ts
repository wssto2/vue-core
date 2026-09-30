import { createWebHistory, type RouterHistory } from "vue-router";

/**
 * Whether the app runs as an iOS home-screen app. `navigator.standalone` exists only in iOS Safari
 * and is true only there (Android installed apps and desktop never set it).
 */
export function isIosHomeScreenApp(nav: Navigator = navigator): boolean {
  return (nav as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * Web history whose every push replaces the current entry: the URL still follows the route (reload,
 * deep links and notification links keep working), but no entry is ever added behind it.
 *
 * For the iOS home-screen app: there iOS gives the left edge a native "back" swipe as soon as there
 * is history, which a page cannot reliably cancel, and it takes the edge from the navigation drawer.
 * The app has no browser back button, and its own back navigates to the parent route.
 */
export function createReplaceOnlyHistory(base?: string): RouterHistory {
  const history = createWebHistory(base);
  history.push = (to, data) => history.replace(to, data);
  return history;
}

/** The router's history: replace-only in the iOS home-screen app, plain web history elsewhere. */
export function createAppHistory(base?: string): RouterHistory {
  return isIosHomeScreenApp() ? createReplaceOnlyHistory(base) : createWebHistory(base);
}
