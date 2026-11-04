import type { RouteLocationRaw } from "vue-router";

/**
 * One precondition row. `met` is the only required signal; everything else is
 * presentation. `hint` explains — in user language — why it is not met, and
 * `fix` deep-links to the screen that resolves it.
 */
export type RequirementItem = {
  key: string;
  label: string;
  met: boolean;
  hint?: string;
  fix?: { label: string; to: RouteLocationRaw };
};
