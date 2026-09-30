import { computed, ref, type ComputedRef } from "vue";
import { useLeaveGuard } from "./leaveGuard";

/**
 * "Has the user changed anything?" for screens that keep their values in plain refs rather than a form:
 * compares a JSON snapshot of `source` with the one taken at the last `markClean()`. Before the first
 * `markClean()` nothing reads as dirty, so a page that is still loading never asks.
 *
 *   const dirty = useDirtySnapshot(() => ({ note: note.value, amount: amount.value }));
 *   dirty.markClean();          // after loading or saving
 */
export function useDirtySnapshot(source: () => unknown): { isDirty: ComputedRef<boolean>; markClean: () => void } {
  const baseline = ref<string | null>(null);
  return {
    isDirty: computed(() => baseline.value !== null && JSON.stringify(source()) !== baseline.value),
    markClean: () => (baseline.value = JSON.stringify(source())),
  };
}

/**
 * "Discard changes?" for a sheet over plain refs (a `Modal` you fill yourself): dismissing it (Cancel, Escape,
 * the scrim) or leaving the page while it holds unsaved input asks first.
 *
 *   const guard = useSheetDiscardGuard(() => [name.value, amount.value]);
 *   // on present:  fill the refs; guard.opened(); modal.present()
 *   // after a save: guard.closed(); modal.dismiss()
 *   // <Modal :before-dismiss="guard.beforeDismiss" @dismissed="guard.closed">
 *
 * A sheet over a form's values is `useGroupSheet`, which does this and more.
 */
export function useSheetDiscardGuard(source: () => unknown): { opened: () => void; closed: () => void; beforeDismiss: () => Promise<boolean> } {
  const open = ref(false);
  const dirty = useDirtySnapshot(source);
  const { confirmDiscard } = useLeaveGuard(() => open.value && dirty.isDirty.value);
  return {
    /** The sheet was just filled: its current values are the baseline. */
    opened: () => {
      dirty.markClean();
      open.value = true;
    },
    /** The sheet closes with nothing to lose (after a save, or once it has closed). */
    closed: () => {
      open.value = false;
    },
    beforeDismiss: confirmDiscard,
  };
}
