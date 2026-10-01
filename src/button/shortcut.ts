import { computed, shallowRef, toValue, triggerRef, watchEffect, type ComputedRef, type MaybeRefOrGetter, type ShallowRef } from "vue";
import { perDocument } from "../internal/perDocument";

/**
 * A keyboard shortcut: the key (case-insensitive, as `KeyboardEvent.key`) and exactly the modifiers listed.
 * With a `label` it is listed by `useShortcutRegistry()` (a help dialog) for as long as its owner is mounted.
 */
export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  /** What it does, in the app's language ("Search the list"); a function is read when the list is read, so it follows the locale. An empty text is not listed. */
  label?: string | (() => string);
  /** The heading it is listed under; any name the app has a heading for. The library's own use `"list"` and `"record"`. */
  group?: string;
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

    if (current.label !== undefined) {
      const entry = list(current);
      onCleanup(entry.remove);
    }

    const listener = (event: KeyboardEvent) => {
      if (event.repeat || !matchesShortcut(event, current)) return;
      if (!(current.ctrlKey || current.altKey || current.metaKey) && isTyping(event.target)) return;
      if (run(event) !== false) event.preventDefault();
    };
    window.addEventListener("keydown", listener);
    onCleanup(() => window.removeEventListener("keydown", listener));
  });
}

// Per document, created on first use. The list is a plain array and `changed` is only triggered, never read by the effect that registers: that effect must not subscribe to what it writes.
const REGISTERED = Symbol("vue-core:shortcuts");
const registered = () => perDocument<{ items: KeyboardShortcut[]; changed: ShallowRef<number> }>(REGISTERED, () => ({ items: [], changed: shallowRef(0) }));

function list(shortcut: KeyboardShortcut): { remove(): void } {
  const state = registered();
  state.items = [...state.items, shortcut];
  triggerRef(state.changed);
  return {
    remove() {
      state.items = state.items.filter((item) => item !== shortcut);
      triggerRef(state.changed);
    },
  };
}

/** The key and modifiers as keycap texts: `["Ctrl", "S"]`, or `["⌘", "K"]` on Apple platforms; arrows as arrows. */
export function shortcutKeys(shortcut: KeyboardShortcut): string[] {
  const apple = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
  const names = apple ? { ctrl: "⌃", alt: "⌥", shift: "⇧", meta: "⌘" } : { ctrl: "Ctrl", alt: "Alt", shift: "Shift", meta: "Meta" };
  const key = KEY_NAMES[shortcut.key] ?? (shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key);
  return [
    ...(shortcut.ctrlKey ? [names.ctrl] : []),
    ...(shortcut.altKey ? [names.alt] : []),
    ...(shortcut.shiftKey ? [names.shift] : []),
    ...(shortcut.metaKey ? [names.meta] : []),
    key,
  ];
}
const KEY_NAMES: Record<string, string> = { ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", Escape: "Esc", " ": "Space" };

/** One row of a shortcut help list: what it does and every way of doing it (`/`, or `J` and `→`). */
export interface ShortcutListing {
  readonly group: string | null;
  readonly label: string;
  /** Each alternative as keycap texts, see `shortcutKeys`. */
  readonly keys: readonly (readonly string[])[];
}

/**
 * The shortcuts that exist on the page right now, for a help dialog: every `useKeyboardShortcut`
 * with a `label` whose owner is mounted, the library's own included (list search and filters, the
 * record pager). Rows with the same group and label are one row (two lists on a page share "/");
 * reactive, so the dialog follows pages and locale.
 *
 *   const rows = useShortcutRegistry();
 *   <dl v-for="row in rows"><dt>{{ row.label }}</dt><dd><kbd v-for="key in row.keys[0]">{{ key }}</kbd></dd></dl>
 */
export function useShortcutRegistry(): ComputedRef<ShortcutListing[]> {
  const state = registered();
  return computed(() => {
    void state.changed.value;
    const rows = new Map<string, { group: string | null; label: string; keys: string[][] }>();
    for (const shortcut of state.items) {
      const label = typeof shortcut.label === "function" ? shortcut.label() : (shortcut.label ?? "");
      if (label === "") continue; // nothing to say right now (a filter key on a list without filters)
      const group = shortcut.group ?? null;
      const row = rows.get(`${group}\u0000${label}`) ?? { group, label, keys: [] };
      const keys = shortcutKeys(shortcut);
      if (!row.keys.some((known) => known.join("+") === keys.join("+"))) row.keys.push(keys);
      rows.set(`${group}\u0000${label}`, row);
    }
    return [...rows.values()];
  });
}
