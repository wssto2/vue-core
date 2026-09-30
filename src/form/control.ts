import { computed, type ComputedRef } from "vue";
import { controlSurface, controlSurfacePairs, type ControlKind, type ControlState } from "../controls";
import { useFormGroup } from "./field";

const MOTION = "rounded-control transition-[background-color,box-shadow,opacity] duration-motion-fast ease-motion-standard";

/**
 * The surface classes of a filled control. In a group row they are the row's own (filled on desktop, plain on
 * phones where the row carries the label); a field on its own has no row, so it keeps the filled look everywhere.
 */
export function useControlSurface(kind: ControlKind, state: () => ControlState): ComputedRef<string> {
  const inRow = !!useFormGroup();
  return computed(() => (inRow ? controlSurface({ kind, state: state() }) : [MOTION, ...controlSurfacePairs(kind, state()).map(([desktop]) => desktop)].join(" ")));
}

/** `compact:` classes only make sense inside a group row (phones restyle it); elsewhere they would restyle a control that has no row. */
export const inRowClass = (inRow: boolean, inside: string, alone: string): string => (inRow ? inside : alone);
