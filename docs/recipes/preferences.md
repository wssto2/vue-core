# Recipe: preferences and tips

go-core's identity module keeps one JSON object per person: the settings they chose (dark mode, the density of a list, the tips they closed). It comes with the session (`preferences` of `/auth/me`) and is saved with `PUT /v1/auth/preferences`, which merges what it is sent into what is stored and answers the merged object. vue-core reads it, saves it with the screen updated first, and builds two things on it: the dark-mode switch and the tip beside something new.

## `usePreferences`

<!-- example: docs/examples/preferences/ViewMode.vue -->
```vue
<script setup lang="ts">
import { usePreferences } from "@wssto2/vue-core/identity";
import { computed } from "vue";

// The shape of what this application keeps for a person; the server stores whatever object it is given.
interface Preferences {
  dark_mode: boolean;
  tickets: { density: "comfortable" | "compact"; columns: string[] };
}

const preferences = usePreferences<Preferences>();
const density = computed(() => preferences.value.value.tickets?.density ?? "comfortable");

// On screen at once; sent as { preferences: { tickets: { density } } }; taken back with a toast when the server refuses.
const choose = (next: Preferences["tickets"]["density"]) => preferences.save({ tickets: { density: next } });
// `null` deletes a key; an array replaces the stored one.
const reset = () => preferences.save({ tickets: { density: null, columns: ["id", "subject"] } });
</script>

<template>
  <div role="group" aria-label="Density">
    <button type="button" :aria-pressed="density === 'comfortable'" @click="choose('comfortable')">Comfortable</button>
    <button type="button" :aria-pressed="density === 'compact'" @click="choose('compact')">Compact</button>
    <button type="button" @click="reset">Reset</button>
  </div>
</template>
```

- `value` is reactive and is everything stored for the person (`{}` when nothing is; nothing is shown as stored for an anonymous visitor). Members may be missing, so `value` is typed as a partial of your shape.
- `save(patch)` takes a **merge patch** (RFC 7396): an object merges into the stored one, `null` deletes a key, anything else, **arrays included**, replaces. To add to a list, send the whole list. The patch is applied to `value` at once; when the server answers, `value` becomes the server's merged object (an app may give the server its own merge rule, which is why the answer, not the patch, wins).
- Saves are sent one after another, in the order they were made, whoever made them (the platform has one queue). When the server refuses one, only that patch is taken back, the others stay, and a toast says so (`save` resolves `false`; a 401 says nothing, the sign-in prompt already does). The server caps the size of what it stores, so keep preferences small.
- Outside a component (a store, a route guard) use `preferencesOf(platform)` from `@wssto2/vue-core/platform`: the same, but `save` rejects with the failure and reports nothing.

## Dark mode

`darkMode()` with no options is the preference `dark_mode`: the switch in the account menu reads and saves it, and the page follows it from the moment the application mounts.

<!-- example: docs/examples/preferences/main.ts -->
```ts
import { createApplication } from "@wssto2/vue-core/app";
import { identityFeature, identityPlatform } from "@wssto2/vue-core/identity";
import { createPlatform, readBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell, darkMode } from "@wssto2/vue-core/shell";

const platform = createPlatform({ config: readBootstrap(), ...identityPlatform() });

// `darkMode()` keeps the person's choice as `dark_mode` in their stored preferences: nothing else to write.
void createApplication({ platform, shell: backofficeShell(), features: [identityFeature({ home: "/" }), darkMode()] }).mount("#app");
```

`darkMode({ dark, set })` is still there for a preference kept elsewhere (see the [shell recipe](shell.md)).

## `Tip`

`Tip` (in `@wssto2/vue-core/onboarding`) is a card beside something new: an icon, a title, a sentence and a button. It points at the first visible element a CSS selector matches (or at an element you pass), which glows while the tip is open. The anchor may render after the tip; it is looked for a few seconds. It stays until the person closes it with the button, the × or Escape, and then never again: its `id` is added to the list stored at `dismissedAt`, a path of keys in the preferences (default `["tips_dismissed"]`; the example uses `onboarding.tips_dismissed`).

<!-- example: docs/examples/preferences/Tips.vue -->
```vue
<script setup lang="ts">
import { Tip } from "@wssto2/vue-core/onboarding";
import { ref } from "vue";

// The app's own sequencing: the tip waits until its welcome is over.
const welcomed = ref(true);
</script>

<template>
  <button type="button" data-test="quick-search">Search</button>

  <!-- Shown beside the button until the person closes it; the id is stored under onboarding.tips_dismissed. -->
  <Tip
    id="search"
    anchor="[data-test=quick-search]"
    :ready="welcomed"
    :dismissed-at="['onboarding', 'tips_dismissed']"
    title="Quick search"
    text="Press Ctrl + K to find a ticket, a person or a page."
  />
</template>
```

- One tip is open at a time in the application; a second waits for the first to close. `ready="false"` holds a tip back until what comes before it (a welcome, a release note) is done: that order is the application's.
- It is a non-modal dialog (`role="dialog"`, named by the title). It does not take the focus from what the person is typing in; when nothing has the focus, the button gets it. Escape closes it, and focus goes back to the anchor.
- The save is applied at once, so the tip goes at once; a refused save brings it back with a toast.
- `text` or the default slot is the sentence; `icon` is any icon name (default `informationLine`). The button says "Got it" and the close button "Close" in the library's languages (`core.tip.ok`, `core.actions.close`).
- The glow is `[data-tip-anchor]` in the library's stylesheet; override it there if the anchor needs another ring.
- Test ids: `tip-<id>` and `tip-ok-<id>`.

## Testing

`createTestPlatform({ preferences })` starts the person with stored preferences; a `save` needs a transport that answers `PUT /v1/auth/preferences` with `{ success: true, data: { preferences } }` (`routedTransport`, see [testing](testing.md)).

<!-- example: docs/examples/preferences/test.ts -->
```ts
import { createTestPlatform } from "@wssto2/vue-core/testing";
import { preferencesOf } from "@wssto2/vue-core/platform";

// In a test the person starts with the preferences you give them; `save` needs a transport that answers PUT /v1/auth/preferences.
const platform = createTestPlatform({ preferences: { dark_mode: false } });
export const stored = preferencesOf<{ dark_mode: boolean }>(platform).value;
```
