import { computed, type ComputedRef } from "vue";
import { useMediaQuery } from "../internal/mediaQuery";
import type { Column } from "./columns";

/**
 * How a list lays out its rows: below 1024 px (`narrow`), and when any column has a `mobile` role
 * other than `hidden`, the rows are phone rows (`phone`); otherwise it stays a table at every width.
 */
export function useRowLayout(columns: () => readonly Pick<Column<never>, "mobile">[]): { narrow: ComputedRef<boolean>; phone: ComputedRef<boolean> } {
  const below = useMediaQuery("(max-width: 1023px)");
  const hasRoles = computed(() => columns().some((column) => column.mobile && column.mobile !== "hidden"));
  return { narrow: computed(() => below.value), phone: computed(() => below.value && hasRoles.value) };
}
