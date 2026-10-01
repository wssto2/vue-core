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
