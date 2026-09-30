import { nextTick, onUnmounted, ref, watch, type Ref } from "vue";
import { focusableWithin } from "../internal/focusable";
import { useDialogStack } from "./dialogStack";

/** Controls marked with this attribute never receive a dialog's initial focus (the close button). */
export const INITIAL_FOCUS_SKIP_ATTR = "data-initial-focus-skip";

export interface DialogOptions {
  /** Asked before dismissing; resolving false keeps the dialog open (dirty guards). */
  beforeDismiss?: () => Promise<boolean> | boolean;
  /** What Escape does; by default `dismiss()`. */
  onEscape?: () => void;
  /**
   * Focus the first control (default) or the panel itself when the dialog opens. A function is
   * read at that moment (the panel on phones, where focusing a field would raise the keyboard
   * over the sheet before the user asked).
   */
  initialFocus?: "first" | "panel" | (() => "first" | "panel");
  /** Runs once the dialog has opened and taken focus. */
  onPresented?: () => void;
  /** Runs once the dialog has closed, however it was closed. */
  onDismissed?: () => void;
}

/**
 * The open and close choreography every modal overlay shares (Modal, Sheet, AlertDialog): the
 * dialog stack (inert background, scroll lock, topmost-only Escape), initial focus, a Tab trap,
 * focus restoration. Presentation stays in the component; build a new overlay on this instead of
 * re-implementing any of it.
 *
 *   const panel = ref<HTMLElement | null>(null);
 *   const dialog = useDialog(panel, { onDismissed: () => emit("dismissed") });
 *   dialog.present();   dialog.dismiss();
 */
export function useDialog(panel: Ref<HTMLElement | null>, options: DialogOptions = {}) {
  const { isTop, activate, deactivate } = useDialogStack(panel);
  const isOpen = ref(false);

  // The element that had focus before the dialog opened. For a nested dialog that is a control
  // inside its parent, which is why the parent is released from inertness before focus goes back.
  let previouslyFocused: HTMLElement | null = null;

  function focusInitial() {
    const container = panel.value;
    if (!container) return;

    const mode = typeof options.initialFocus === "function" ? options.initialFocus() : options.initialFocus;
    const first = mode === "panel" ? undefined : focusableWithin(container).find((element) => !element.hasAttribute(INITIAL_FOCUS_SKIP_ATTR));

    // The panel is the fallback: a dialog with nothing focusable still has to take focus away
    // from the inert background.
    (first ?? container).focus({ preventScroll: true });
  }

  function present() {
    if (isOpen.value) return;

    previouslyFocused = document.activeElement as HTMLElement | null;
    isOpen.value = true;

    void nextTick(() => {
      // After render: the stack needs the mounted root to decide what stays interactive, and
      // initial focus needs the content to exist.
      activate();
      focusInitial();
      options.onPresented?.();
    });
  }

  function restoreFocus() {
    const target = previouslyFocused;
    previouslyFocused = null;
    // A dialog that opened meanwhile already owns the top of the stack; do not steal focus from it.
    if (target?.isConnected && !target.closest("[inert]")) target.focus();
  }

  /** Closes without asking `beforeDismiss` (the guard itself already answered). */
  function dismissWithoutAsking() {
    if (!isOpen.value) return;

    isOpen.value = false;
    // Synchronous, so a parent dialog is interactive again before focus moves.
    deactivate();
    options.onDismissed?.();
    void nextTick(restoreFocus);
  }

  /**
   * Closes unless `beforeDismiss` refuses; returns whether the dialog closed. Synchronous when the
   * guard answers synchronously, so nothing waits a microtask when there is nothing to ask.
   */
  function dismiss(): Promise<boolean> | boolean {
    if (!isOpen.value) return true;

    const verdict = options.beforeDismiss?.() ?? true;
    if (verdict instanceof Promise) {
      return verdict.then((ok) => {
        if (ok) dismissWithoutAsking();
        return ok;
      });
    }
    if (verdict) dismissWithoutAsking();

    return verdict;
  }

  function trapTab(event: KeyboardEvent) {
    const container = panel.value;
    if (!container) return;

    const items = focusableWithin(container);
    const first = items[0];
    const last = items[items.length - 1];

    if (!first || !last) {
      event.preventDefault();
      container.focus();
      return;
    }

    const active = document.activeElement;
    if (!active || !container.contains(active)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (!isOpen.value || !isTop.value) return;

    if (event.key === "Escape") {
      // A control inside the dialog closed its own layer with this Escape (a popover, a date
      // picker): the dialog stays.
      if (event.defaultPrevented) return;
      event.preventDefault();
      if (options.onEscape) options.onEscape();
      else void dismiss();
      return;
    }

    if (event.key === "Tab") trapTab(event);
  }

  watch(isOpen, (open) => {
    if (open) document.addEventListener("keydown", onKeydown);
    else document.removeEventListener("keydown", onKeydown);
  });

  onUnmounted(() => {
    document.removeEventListener("keydown", onKeydown);
    if (isOpen.value) restoreFocus();
  });

  return { isOpen, isTop, present, dismiss, dismissWithoutAsking };
}
