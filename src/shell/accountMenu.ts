import { defineFeatureContext } from "../platform/context";

/** What the rows of an account menu need from the menu around them. */
export interface AccountMenuContext {
  /** `popover` on desktop, `sheet` on phones: rows change their look, not their content. */
  readonly appearance: "popover" | "sheet";
  /** Closes the menu (a row that navigates or runs a command closes it first). */
  close(): void;
}

export const [accountMenuKey, useAccountMenu] = defineFeatureContext<AccountMenuContext>("vue-core.accountMenu");

/** Where a header action is drawn: on the dark sidebar, or on the page-coloured phone bar. */
export const [headerSurfaceKey] = defineFeatureContext<"rail" | "bar">("vue-core.headerSurface");
