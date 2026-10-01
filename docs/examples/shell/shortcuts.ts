import { defineFeature } from "@wssto2/vue-core/app";
import { ShortcutHelp } from "@wssto2/vue-core/modal";

// The "?" dialog, mounted once in the shell's `host` outlet: it lists whatever shortcuts the page registered.
export const shortcutsFeature = defineFeature({
  id: "shortcuts",
  contributions: [{ id: "shortcuts.help", slot: "host", component: ShortcutHelp, scope: "authenticated" }],
});
