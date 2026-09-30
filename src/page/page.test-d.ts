// Type fixtures, checked by `npm run typecheck`: page actions and the shell say what they mean.
import { h } from "vue";
import AdaptivePageShell from "./AdaptivePageShell.vue";
import type { PageAction } from "./types";

export const save: PageAction = { id: "save", label: "Save", placement: "primary", onClick: () => {} };
export const remove: PageAction = { id: "delete", label: "Delete", tone: "critical", onClick: () => {} };
export const edit: PageAction = { id: "edit", label: "Edit", placement: "primary", prominence: "standard", onClick: () => {} };

// @ts-expect-error tone is a meaning (critical), not ARV's "destructive" or a colour
export const old: PageAction = { id: "x", label: "X", tone: "destructive", onClick: () => {} };
// @ts-expect-error a placement nobody defined
export const nowhere: PageAction = { id: "x", label: "X", placement: "bottom", onClick: () => {} };
// @ts-expect-error an action has to do something
export const inert: PageAction = { id: "x", label: "X" };

h(AdaptivePageShell, { title: "Customer", width: "content", back: { label: "Customers", to: "/customers" } });
// @ts-expect-error widths are a union
h(AdaptivePageShell, { title: "Customer", width: "wide" });
