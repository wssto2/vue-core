import { recentChoicesKey, type RecentChoices, type SelectOption } from "@wssto2/vue-core/form";
import { phoneDefaultsKey } from "@wssto2/vue-core/phone";
import type { App } from "vue";

/** Once, in the composition root: what the app says about its phone numbers and, if not the browser's `localStorage`, where recent choices are kept. */
export function installFieldDefaults(app: App, recents?: RecentChoices) {
  app.provide(phoneDefaultsKey, { defaultCountry: "HR", commonCountries: ["HR", "BA", "SI", "RS", "AT", "DE"] });
  if (recents) app.provide(recentChoicesKey, recents);
}

/** An adapter that keeps recent choices in memory (for tests, or a store the app fills from its own settings). */
export function memoryRecents(): RecentChoices {
  const kept = new Map<string, readonly SelectOption<string | number>[]>();
  return { read: (id) => kept.get(id) ?? [], write: (id, choices) => void kept.set(id, choices) };
}
