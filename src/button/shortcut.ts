import { toValue, watchEffect, type MaybeRefOrGetter } from "vue";

/** A keyboard shortcut: the key (case-insensitive, as `KeyboardEvent.key`) and exactly the modifiers listed. */
export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

export function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  return (
    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
    event.ctrlKey === (shortcut.ctrlKey ?? false) &&
    event.shiftKey === (shortcut.shiftKey ?? false) &&
    event.altKey === (shortcut.altKey ?? false) &&
    event.metaKey === (shortcut.metaKey ?? false)
  );
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName));
}

/**
 * Runs `run` when the shortcut is pressed anywhere on the page; `run` returns `false` when it
 * did not act (a disabled button, an element behind a dialog), which leaves the key alone.
 * Reactive (a changed shortcut re-registers), one listener per caller, removed with the caller's
 * scope. A shortcut without Ctrl, Alt or Meta never fires while the user is typing in a field.
 */
export function useKeyboardShortcut(
  shortcut: MaybeRefOrGetter<KeyboardShortcut | undefined>,
  run: (event: KeyboardEvent) => void | false,
): void {
  watchEffect((onCleanup) => {
    const current = toValue(shortcut);
    if (!current) return;

    const listener = (event: KeyboardEvent) => {
      if (event.repeat || !matchesShortcut(event, current)) return;
      if (!(current.ctrlKey || current.altKey || current.metaKey) && isTyping(event.target)) return;
      if (run(event) !== false) event.preventDefault();
    };
    window.addEventListener("keydown", listener);
    onCleanup(() => window.removeEventListener("keydown", listener));
  });
}
