import { defineComponent, h, type PropType } from "vue";
import { defineFeatureContext } from "../platform/context";
import type { Session } from "../platform/session";
import type { ShellContribution, ShellSlot } from "./feature";

/** A contribution with the feature that declared it, for error messages. */
export interface OwnedContribution {
  readonly feature: string;
  readonly contribution: ShellContribution;
}

/** What a shell renders in each of its places. Reactive to the session (scope). */
export interface ShellContributions {
  /** The contributions of a slot that apply now, in order. Call it while rendering. */
  get(slot: ShellSlot): readonly ShellContribution[];
}

export function createShellContributions(owned: readonly OwnedContribution[], session: Session): ShellContributions {
  // Sorted once: `order`, then the position in the feature list (Array.prototype.sort is stable).
  const sorted = owned.map(({ contribution }) => contribution).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return {
    get(slot) {
      const authenticated = session.state.value.status === "authenticated";
      return sorted.filter((entry) => entry.slot === slot && (entry.scope === "always" || authenticated));
    },
  };
}

/** The contributions of the application: installed by `createApplication`, read by `ShellOutlet`. */
export const [shellContributionsKey, useShellContributions] = defineFeatureContext<ShellContributions>("vue-core.shellContributions");

/**
 * Where a shell renders what features contribute to one of its places. A shell puts one outlet at
 * each place it offers and wraps it as its layout needs; the outlet itself adds no element.
 *
 *   <div class="flex gap-2"><ShellOutlet name="headerActions" /></div>
 */
export const ShellOutlet = defineComponent({
  name: "ShellOutlet",
  props: { name: { type: String as PropType<ShellSlot>, required: true } },
  setup(props) {
    const contributions = useShellContributions();
    return () => contributions.get(props.name).map((entry) => h(entry.component, { key: entry.id }));
  },
});
