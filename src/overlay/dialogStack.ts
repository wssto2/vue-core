import { computed, onUnmounted, shallowRef, type ComputedRef, type Ref, type ShallowRef } from "vue";
import { perDocument } from "../internal/perDocument";

/**
 * One stack for every open dialog, so nested dialogs behave.
 *
 * Each dialog teleports its own root into `<body>`, so a nested dialog is a sibling of the one
 * that opened it, not a descendant. Three things are therefore decided for the document rather
 * than per dialog:
 *
 * - Inertness. Everything in `<body>` that does not contain the topmost dialog is marked `inert`
 *   (out of the tab order, hit testing and the accessibility tree). Opening a nested dialog makes
 *   its parent inert; closing it hands the parent back. Only what the stack itself made inert is
 *   released again: an element that was inert already stays so.
 * - Escape. Only the topmost dialog reacts, otherwise one keypress closes the whole stack.
 * - Scroll locking. The lock belongs to the stack, so closing a nested dialog does not unlock the
 *   page under its parent.
 *
 * An overlay that may sit above the topmost dialog (a menu, a tooltip) opts out of inertness with
 * `data-dialog-inert-skip`.
 */
export const INERT_SKIP_ATTR = "data-dialog-inert-skip";
/** The class the stack puts on `<body>` while a dialog is open. */
export const SCROLL_LOCK_CLASS = "overflow-hidden";

interface Entry {
  root: () => HTMLElement | null;
}

interface Stack {
  // Replaced rather than mutated, so `isTop` re-evaluates on every change.
  entries: ShallowRef<Entry[]>;
  inertedByUs: Set<HTMLElement>;
  lockedByUs: boolean;
}

const STACK = Symbol("vue-core:dialog-stack");
const stack = () => perDocument<Stack>(STACK, () => ({ entries: shallowRef([]), inertedByUs: new Set(), lockedByUs: false }));

function sync(state: Stack) {
  const top = state.entries.value[state.entries.value.length - 1]?.root() ?? null;

  for (const child of Array.from(document.body.children)) {
    if (!(child instanceof HTMLElement)) continue;
    const shouldBeInert = top !== null && !child.hasAttribute(INERT_SKIP_ATTR) && !child.contains(top);
    if (shouldBeInert && !child.inert) {
      child.inert = true;
      state.inertedByUs.add(child);
    } else if (!shouldBeInert && state.inertedByUs.has(child)) {
      child.inert = false;
      state.inertedByUs.delete(child);
    }
  }

  const open = state.entries.value.length > 0;
  if (open && !document.body.classList.contains(SCROLL_LOCK_CLASS)) {
    document.body.classList.add(SCROLL_LOCK_CLASS);
    state.lockedByUs = true;
  } else if (!open && state.lockedByUs) {
    document.body.classList.remove(SCROLL_LOCK_CLASS);
    state.lockedByUs = false;
  }
}

export function useDialogStack(root: Ref<HTMLElement | null>): {
  isTop: ComputedRef<boolean>;
  activate: () => void;
  deactivate: () => void;
} {
  const state = stack();
  const entry: Entry = { root: () => root.value };
  const isTop = computed(() => state.entries.value[state.entries.value.length - 1] === entry);

  const activate = () => {
    // Re-syncing an entry that is already on the stack is how a dialog picks up its own root
    // once it has rendered.
    if (!state.entries.value.includes(entry)) state.entries.value = [...state.entries.value, entry];
    sync(state);
  };

  const deactivate = () => {
    if (!state.entries.value.includes(entry)) return;
    state.entries.value = state.entries.value.filter((item) => item !== entry);
    sync(state);
  };

  onUnmounted(deactivate);

  return { isTop, activate, deactivate };
}
