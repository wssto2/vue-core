import { computed, type ComputedRef } from "vue";
import { useShellContributions } from "../app/contributions";

/** Whether something is contributed to the shell's `search` slot now, so the room around it is only made then. */
export function useHasSearch(): ComputedRef<boolean> {
  const contributions = useShellContributions();
  return computed(() => contributions.get("search").length > 0);
}
