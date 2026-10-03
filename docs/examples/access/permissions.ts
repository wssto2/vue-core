// What go-core's `authzts` writes from the application's catalogue (`frontend/generated/permissions.ts`), shortened to two entries.
// The texts are the application's: `labelKey` and `descriptionKey` are keys of its own messages.
import type { PermissionCatalogue } from "@wssto2/vue-core/access";

export const permissions: PermissionCatalogue = {
  "tickets.ticket:view": { module: "tickets", resource: "ticket", verb: "view", labelKey: "perm.tickets.ticket.view", descriptionKey: "", sensitive: false, system: false, organizationOnly: false, ownable: "tickets.ticket", unownedIsOwn: false, feature: null, attributes: [], requires: [] },
  "tickets.ticket:delete": { module: "tickets", resource: "ticket", verb: "delete", labelKey: "perm.tickets.ticket.delete", descriptionKey: "", sensitive: true, system: false, organizationOnly: false, ownable: "tickets.ticket", unownedIsOwn: false, feature: null, attributes: [], requires: ["tickets.ticket:view"] },
};
