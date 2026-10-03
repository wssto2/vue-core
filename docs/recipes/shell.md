# Recipe: the shell

The shell is the frame around every page: a dark sidebar and account menu on desktop, a top bar with a push drawer on phones, the page progress bar, toasts. `backofficeShell()` is the one the library ships; everything a feature wants in it comes through **named slots**, so features never import the shell.

## The default shell

<!-- example: docs/examples/shell/default.ts -->
```ts
import { createPlatform, httpSessionAdapter, readBootstrap, type SessionUser } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";
import Brand from "./Brand.vue";

// The application's own user: what its session adapter produces, and what the shell's `identity` is typed with.
interface Employee extends SessionUser {
  readonly name: string;
  readonly email: string;
}

export const platform = createPlatform({
  config: readBootstrap(),
  session: (http) => httpSessionAdapter(http, { parseUser: (raw) => raw as Employee }),
});

// Every option is optional: `backofficeShell()` alone shows the user's name and e-mail and the application's name.
export const shell = backofficeShell({
  identity: (user: Employee) => ({ name: user.name, detail: user.email }),
  brand: Brand,
  home: "/tickets",
});
```

`identity` is typed with *your* session user (the adapter's `parseUser` produces it). The `brand` component receives `tone`:

<!-- example: docs/examples/shell/Brand.vue -->
```vue
<script setup lang="ts">
// The logo the shell asks for: `tone` says where it sits, light on the dark sidebar, brand-coloured on the page.
defineProps<{ tone: "light" | "brand" }>();
</script>

<template>
  <span class="text-headline font-semibold" :class="tone === 'light' ? 'text-white' : 'text-tint'">Acme</span>
</template>
```

The other options are `footer` (above the account block) and `topBarEnd`. Use one `backofficeShell()` per application: it owns that application's page-load indicator.

## Contributing to the shell

A feature puts a component into a slot. The shell documents four:

| Slot | For |
|---|---|
| `headerActions` | icon buttons of the top bar (a notification bell, a search button) |
| `accountMenu` | rows of the signed-in user's menu (a popover on desktop, a grouped sheet on phones) |
| `banner` | a strip across the top of the whole shell, above everything (a notice that must stay in view: signed in as somebody else); a custom shell renders `<ShellOutlet name="banner" />` first |
| `host` | components with no place of their own that must be mounted once (a command palette, a dialog host) |

<!-- example: docs/examples/shell/feature.ts -->
```ts
import { defineFeature } from "@wssto2/vue-core/app";
import { localeMessages } from "@wssto2/vue-core/i18n";
import NotificationBell from "./NotificationBell.vue";

// A feature that only contributes to the shell, without the shell's source knowing it. Any shell
// that renders the `headerActions` outlet shows it: the default one and a custom one alike.
export const notificationsFeature = defineFeature({
  id: "notifications",
  messages: localeMessages("notifications", { en: async () => ({ default: { label: "Notifications, {count} unread", none: "No new notifications." } }) }),
  contributions: [
    // `authenticated`: only while someone is signed in. `messages` are loaded before the component renders.
    { id: "notifications.bell", slot: "headerActions", component: NotificationBell, scope: "authenticated", messages: ["notifications"] },
  ],
});
```

<!-- example: docs/examples/shell/NotificationBell.vue -->
```vue
<script setup lang="ts">
import { toast } from "@wssto2/vue-core/overlay";
import { HeaderAction } from "@wssto2/vue-core/shell";
import { useI18n } from "vue-i18n";

// What a feature puts into the shell's `headerActions`: `HeaderAction` looks right wherever the shell draws it
// (light on the sidebar, tinted on the phone bar); the label is its accessible name, the badge is decorative.
const { t } = useI18n();
</script>

<template>
  <HeaderAction :label="t('notifications.label', { count: 3 })" icon="informationLine" :badge="3" @click="toast.info(t('notifications.none'))" />
</template>
```

- `scope: "authenticated"` renders only while someone is signed in, `"always"` also on the login page. Contributions appear and disappear with the session.
- `messages` names the namespaces the component needs; they load before it renders.
- `order` sorts within a slot (ties keep the feature list's order). `optional: true` lets a shell without that slot leave the contribution out instead of failing startup.
- An `accountMenu` row is `AccountMenuItem`: a link (`to`), a button, a switch (`checked`) or a choice (`selected`):

<!-- example: docs/examples/shell/DarkModeRow.vue -->
```vue
<script setup lang="ts">
import { AccountMenuItem } from "@wssto2/vue-core/shell";
import { ref } from "vue";

// A row of the account menu: a switch. The state lives on <html>, where the stylesheet reads it.
const dark = ref(document.documentElement.classList.contains("dark"));

function toggle() {
  dark.value = !dark.value;
  document.documentElement.classList.toggle("dark", dark.value);
}
</script>

<template>
  <AccountMenuItem label="Dark mode" :checked="dark" @click="toggle" />
</template>
```

<!-- example: docs/examples/shell/appearance.ts -->
```ts
import { defineFeature } from "@wssto2/vue-core/app";
import DarkModeRow from "./DarkModeRow.vue";

// `accountMenu` entries render as a popover on desktop and a grouped sheet on phones: write the row once.
export const appearanceFeature = defineFeature({
  id: "appearance",
  contributions: [{ id: "appearance.dark", slot: "accountMenu", component: DarkModeRow, scope: "authenticated", order: 10 }],
});
```

A contribution is mounted once, wherever the shell draws its outlet. Slots are an interface you can extend by declaration merging (`ShellSlots` in `@wssto2/vue-core/app`) when a custom shell offers more places.

## Keyboard shortcuts

`useKeyboardShortcut(shortcut, run)` (from `@wssto2/vue-core/button`) takes an optional `group` and `label` on the shortcut. A labelled shortcut is listed by `useShortcutRegistry()` while its owner is mounted, and the library's own register theirs: `/` and `f` on a list, the arrows and `J` / `K` of the record pager. `ShortcutHelp` is a small "?" dialog over that list; mount it once in the shell's `host` outlet and every page's shortcuts appear in it, grouped (`general`, `list`, `record` are titled by the library, any other group by `core.shortcuts.groups.<group>` in your messages, else by its name).

<!-- example: docs/examples/shell/shortcuts.ts -->
```ts
import { defineFeature } from "@wssto2/vue-core/app";
import { ShortcutHelp } from "@wssto2/vue-core/modal";

// The "?" dialog, mounted once in the shell's `host` outlet: it lists whatever shortcuts the page registered.
export const shortcutsFeature = defineFeature({
  id: "shortcuts",
  contributions: [{ id: "shortcuts.help", slot: "host", component: ShortcutHelp, scope: "authenticated" }],
});
```

<!-- example: docs/examples/shell/newTicketKey.ts -->
```ts
import { useI18n } from "vue-i18n";
import { useKeyboardShortcut } from "@wssto2/vue-core/button";

/** Call it from a page's setup: "n" creates a ticket while the page is mounted, and the "?" dialog lists it. */
export function useNewTicketKey(create: () => void) {
  const { t } = useI18n();
  // A shortcut with a `label` is listed while its owner is mounted. `group` is any name you have a heading for
  // (`core.shortcuts.groups.<group>` in your messages); the library's own are "general", "list" and "record".
  // Without Ctrl, Alt or Meta it is ignored while the user types in a field; returning false from the handler leaves the key alone.
  useKeyboardShortcut({ key: "n", group: "tickets", label: () => t("tickets.shortcuts.new") }, () => create());
}
```

For a dialog of your own, read the list: `useShortcutRegistry()` gives rows of `{ group, label, keys }` (a `keys` entry is the keycap texts of one way to press it, `["Ctrl", "S"]`, `["⌘", "K"]` on a Mac), reactive to pages and locale. An empty label is not listed.

## Inside a frame

An application that runs in a frame of another page needs two things from the library and keeps its own protocol: a count of open dialogs (the host grows the frame or dims its chrome while any is open) and a place for dialogs that suits the frame. `useOpenDialogCount()` (from `@wssto2/vue-core/overlay`) is the count: a reactive number, nested dialogs included. `modalPlacementKey` (from `@wssto2/vue-core/modal`) is the placement of every `Modal` on wide screens: `{ align: "top", offsetX: -120 }`, given as a ref or getter so it can follow the host (a `Modal`'s own `placement` prop wins per field; phones keep the page sheet). `Toaster` already takes a `position`.

<!-- example: docs/examples/shell/embedded.ts -->
```ts
import type { Application } from "@wssto2/vue-core/app";
import { modalPlacementKey } from "@wssto2/vue-core/modal";
import { useOpenDialogCount } from "@wssto2/vue-core/overlay";
import { ref, watch } from "vue";

/** How much of the frame the host page's own sidebar covers; the host tells the application (its message protocol is yours). */
export const hostSidebarWidth = ref(0);

/** For an application shown inside a frame of another page: two generic hooks, no protocol. Call it before `mount()`. */
export function installFrameHooks(application: Application, host: Window, hostOrigin: string) {
  // Dialogs stand near the top (a tall frame has no useful middle) and away from the host's sidebar.
  application.app.provide(modalPlacementKey, () => ({ align: "top", offsetX: -hostSidebarWidth.value / 2 }));

  // How many dialogs are open: the host can grow the frame or dim its own chrome while any is.
  const dialogs = useOpenDialogCount();
  watch(dialogs, (count) => host.postMessage({ type: "dialogs", count }, hostOrigin));
}
```

## A custom shell

A shell is a component plus the list of slots it renders. Compose it from the library's parts (`ShellStage`, `ShellSidebar`, `ShellTopBar`, `NavigationDrawer`, `AccountSheet`, `BottomDock`) and put a `ShellOutlet` at each place you offer; the outlet adds no element, so you wrap it as your layout needs.

<!-- example: docs/examples/shell/CustomShell.vue -->
```vue
<script setup lang="ts">
import { ShellOutlet } from "@wssto2/vue-core/app";
import { BottomDock, usePageChromeContext } from "@wssto2/vue-core/page";
import { LeaveGuardRoot } from "@wssto2/vue-core/form";
import { AppRouterView } from "@wssto2/vue-core/router";
import { AccountSheet, NavigationDrawer, ShellSidebar, ShellStage, ShellTopBar, useShellIdentity } from "@wssto2/vue-core/shell";
import { useTemplateRef } from "vue";

// A shell of the application's own, from the library's pieces: the same sidebar, top bar, phone drawer and
// outlets as `backofficeShell`, arranged differently (a narrow centred column, its own brand). What features
// contribute to `headerActions`, `accountMenu` and `host` still arrives, because this renders the same outlets.
const identity = useShellIdentity(); // null on the login page
const chrome = usePageChromeContext();
const accountSheet = useTemplateRef("accountSheet");
</script>

<template>
  <div class="min-h-screen bg-surface-page text-content">
    <ShellStage :enabled="identity !== null">
      <template v-if="identity" #drawer="{ select, dismiss }">
        <NavigationDrawer :identity="identity" @select="select" @account="dismiss(() => accountSheet?.present())" />
      </template>

      <ShellTopBar />
      <div class="flex">
        <ShellSidebar v-if="identity" :identity="identity">
          <template #brand><span class="block text-headline font-semibold text-white">Acme</span></template>
        </ShellSidebar>
        <main class="mx-auto min-w-0 max-w-2xl flex-1" :class="chrome.hasShell.value ? '' : 'p-4 md:p-8'">
          <AppRouterView />
        </main>
      </div>
      <BottomDock :class="identity ? 'md:left-64' : ''" />
    </ShellStage>
    <AccountSheet v-if="identity" ref="accountSheet" :identity="identity" />
    <ShellOutlet name="host" />
    <!-- The one "Discard changes?" dialog: forms with unsaved changes ask through it. `backofficeShell` renders it; a shell of your own must. -->
    <LeaveGuardRoot />
  </div>
</template>
```

<!-- example: docs/examples/shell/custom.ts -->
```ts
import { createApplication } from "@wssto2/vue-core/app";
import { createPlatform, readBootstrap } from "@wssto2/vue-core/platform";
import { sessionFeature } from "../app/session/feature";
import CustomShell from "./CustomShell.vue";
import { notificationsFeature } from "./feature";

// A custom shell is a component plus the slots it renders. Naming them lets the application fail at startup when a
// feature contributes to a slot the shell does not have (instead of the contribution silently not showing).
createApplication({
  platform: createPlatform({ config: readBootstrap() }),
  shell: { component: CustomShell, slots: ["headerActions", "accountMenu", "host"] },
  features: [sessionFeature, notificationsFeature],
});
```

A shell of your own renders `<LeaveGuardRoot />` once (as `CustomShell.vue` does): `createApplication` installs the application's leave guard, `backofficeShell` renders its dialog, and without the dialog a page with unsaved changes that is left fails with a `MissingLeaveGuardRootError` instead of letting the user lose their work silently.

Naming the slots has a purpose: a feature that contributes to a slot the shell does not render fails at startup, naming the feature, instead of silently showing nothing. The page chrome (the back, the title, the page's actions) is read by `ShellTopBar` from the page itself, so a custom shell gets the same phone bar and sidebar behavior.
