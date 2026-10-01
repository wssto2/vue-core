import { computed, inject, onBeforeUnmount, ref, shallowRef, type InjectionKey } from "vue";
import { isAborted } from "../client";
import { foldText, type SelectOption } from "./options";

/**
 * The engine behind "suggestions while typing", shared by `TextField` (free text: what lands is the string) and
 * `ComboField` (a record pick: what lands is the option's id). A source is a list filtered as the user types, or a
 * function that asks the server for the text typed.
 */
export type SuggestionSource<Value extends string | number> =
  | readonly SelectOption<Value>[]
  | ((query: string, context: { signal: AbortSignal }) => Promise<readonly SelectOption<Value>[]>);

/** A text suggested to a free-text field, with a line of detail under it in the list ("Zagreb", "Croatia · 10 000"). What lands in the field is the text. */
export type TextSuggestion = string | { readonly text: string; readonly detail?: string };

/** `idle`: nothing asked yet (the recent choices show, if the field keeps any). */
export type SuggestionStatus = "idle" | "loading" | "loaded" | "failed";

/** What a field keeps of its last choices. The default adapter is `localStorage`; an app that wants them elsewhere (per user, on the server) provides its own under `recentChoicesKey`. */
export interface RecentChoices {
  read(id: string): readonly SelectOption<string | number>[];
  write(id: string, choices: readonly SelectOption<string | number>[]): void;
}

export const recentChoicesKey: InjectionKey<RecentChoices> = Symbol("vue-core.recentChoices");
export const RECENT_LIMIT = 5;

const isChoice = (value: unknown): value is SelectOption<string | number> => {
  if (typeof value !== "object" || value === null) return false;
  const choice = value as Record<string, unknown>;
  return (typeof choice.value === "string" || typeof choice.value === "number") && typeof choice.label === "string";
};

/** Storage can be missing, full or refused (a private window): recent choices are a convenience and never an error. */
const browserRecents: RecentChoices = {
  read(id) {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(`vue-core.recent.${id}`) ?? "[]");
      return Array.isArray(parsed) ? parsed.filter(isChoice).slice(0, RECENT_LIMIT) : [];
    } catch {
      return [];
    }
  },
  write(id, choices) {
    try {
      localStorage.setItem(`vue-core.recent.${id}`, JSON.stringify(choices));
    } catch {
      /* not stored */
    }
  },
};

/** The label split around the first place the typed text matches it (ignoring case and accents), for the list to mark. */
export function matchParts(label: string, query: string): { before: string; match: string; after: string } {
  const needle = foldText(query.trim());
  if (needle === "") return { before: "", match: "", after: label };
  let folded = "";
  const origin: number[] = []; // for each character of `folded`, where it came from in `label`
  let at = 0;
  for (const character of label) {
    const next = foldText(character);
    for (let index = 0; index < next.length; index++) origin.push(at);
    folded += next;
    at += character.length;
  }
  const found = folded.indexOf(needle);
  if (found < 0) return { before: "", match: "", after: label };
  const start = origin[found] ?? 0;
  const end = origin[found + needle.length] ?? label.length;
  return { before: label.slice(0, start), match: label.slice(start, end), after: label.slice(end) };
}

/** What the grey completion adds after the typed text: the rest of the label, when the label starts with what was typed. */
export function completionOf(typed: string, label: string): string {
  if (typed === "" || label.length <= typed.length) return "";
  return label.toLocaleLowerCase().startsWith(typed.toLocaleLowerCase()) ? label.slice(typed.length) : "";
}

/** The options that match the text, the ones that start with it first (the order inside each is kept). */
function filterLocal<Value extends string | number>(options: readonly SelectOption<Value>[], query: string): SelectOption<Value>[] {
  const needle = foldText(query.trim());
  if (needle === "") return [...options];
  const starts: SelectOption<Value>[] = [];
  const contains: SelectOption<Value>[] = [];
  for (const option of options) {
    const label = foldText(option.label);
    if (label.startsWith(needle)) starts.push(option);
    else if (label.includes(needle) || (option.description !== undefined && foldText(option.description).includes(needle))) contains.push(option);
  }
  return [...starts, ...contains];
}

/** Whether the list has anything to say: rows, a loading or failed line, or (a pick list) that nothing matched. */
export function listShows(open: boolean, count: number, status: SuggestionStatus, emptyMessage: boolean): boolean {
  return open && (count > 0 || status === "loading" || status === "failed" || (status === "loaded" && emptyMessage));
}

export interface SuggestionsOptions<Value extends string | number> {
  source: () => SuggestionSource<Value> | undefined;
  /** The fewest characters before a function source is asked. */
  minLength: () => number;
  /** Milliseconds to wait after the last key before a function source is asked. */
  debounce: () => number;
  limit: () => number;
  /** A fixed pick list shows everything for empty text; free text shows nothing until something is typed. */
  listAllWhenEmpty: boolean;
  /** The id the recent choices are kept under (the field's name); undefined: the field keeps none. */
  recents: () => string | undefined;
}

export interface KeyHooks<Value extends string | number> {
  pick(option: SelectOption<Value>): void;
  /** Free text: Enter picks only a row the user moved to, so Enter keeps meaning "done" while a first suggestion merely waits for Tab. */
  enterNeedsMove: boolean;
  /** Tab: accept the completion; true when there was one (the key is then taken). */
  complete?(): boolean;
}

/**
 * Suggestions for what is being typed: asks the source (debounced, the older request aborted, only the latest answer
 * lands), keeps the highlighted row, the recent choices shown before typing, and the keys. The field owns the text and
 * the input; it calls `ask` on every keystroke, `show` on focus, `close` on blur and `remember` on a pick.
 */
export function useSuggestions<Value extends string | number>(options: SuggestionsOptions<Value>) {
  const store = inject(recentChoicesKey, browserRecents);
  const results = shallowRef<readonly SelectOption<Value>[]>([]);
  const recent = shallowRef<readonly SelectOption<Value>[]>([]);
  const status = ref<SuggestionStatus>("idle");
  const open = ref(false);
  const highlighted = ref(0);
  const moved = ref(false);
  let text = "";
  let version = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let controller: AbortController | null = null;

  /** Recent choices while nothing is asked; otherwise the answer. */
  const items = computed<readonly SelectOption<Value>[]>(() => (status.value === "idle" ? recent.value : results.value));
  const showingRecent = computed(() => status.value === "idle" && recent.value.length > 0);
  const current = computed(() => items.value[highlighted.value]);

  function cancel() {
    version++;
    controller?.abort();
    controller = null;
    if (timer) clearTimeout(timer);
    timer = null;
  }
  onBeforeUnmount(cancel);

  function settle(next: readonly SelectOption<Value>[]) {
    results.value = next.slice(0, options.limit());
    highlighted.value = 0;
    moved.value = false;
  }

  async function run(query: string, source: Extract<SuggestionSource<Value>, (...args: never[]) => unknown>) {
    const mine = ++version;
    controller?.abort();
    controller = new AbortController();
    status.value = "loading";
    try {
      const found = await source(query, { signal: controller.signal });
      if (mine !== version) return;
      settle(found);
      status.value = "loaded";
    } catch (error) {
      if (mine !== version || isAborted(error)) return;
      results.value = [];
      status.value = "failed";
    }
  }

  /** The text changed: ask for suggestions for it. */
  function ask(next: string) {
    text = next;
    cancel();
    open.value = true;
    const source = options.source();
    const empty = next.trim() === "";
    if (!source || (empty && !options.listAllWhenEmpty) || (typeof source === "function" && next.trim().length < options.minLength())) {
      status.value = "idle";
      results.value = [];
      highlighted.value = 0;
      moved.value = false;
      return;
    }
    if (typeof source === "function") timer = setTimeout(() => void run(next, source), options.debounce());
    else {
      settle(filterLocal(source, next));
      status.value = "loaded";
    }
  }

  /** The field got focus: what shows before anything is typed (the recent choices, a fixed list). */
  function show(next: string) {
    const id = options.recents();
    recent.value = id ? (store.read(id) as readonly SelectOption<Value>[]) : [];
    ask(next);
    open.value = items.value.length > 0;
  }

  function close() {
    cancel();
    open.value = false;
    if (status.value === "loading") status.value = "idle";
  }

  function remember(option: SelectOption<Value>) {
    const id = options.recents();
    if (!id) return;
    const kept = (store.read(id) as readonly SelectOption<Value>[]).filter((choice) => choice.value !== option.value);
    store.write(id, [{ value: option.value, label: option.label, ...(option.description !== undefined ? { description: option.description } : {}) }, ...kept].slice(0, RECENT_LIMIT));
  }

  function highlight(index: number, byUser = true) {
    highlighted.value = index;
    if (byUser) moved.value = true;
  }

  function keydown(event: KeyboardEvent, hooks: KeyHooks<Value>) {
    if (event.key === "Escape" && open.value) {
      event.stopPropagation(); // closes the list, not the dialog around it
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open.value) {
        show(text);
        open.value = true;
        return;
      }
      const last = items.value.length - 1;
      highlight(event.key === "ArrowDown" ? Math.min(highlighted.value + 1, last) : Math.max(highlighted.value - 1, 0));
    } else if (event.key === "Enter" && open.value) {
      const option = current.value;
      if (option && !option.disabled && (moved.value || !hooks.enterNeedsMove)) {
        event.preventDefault();
        hooks.pick(option);
      }
    } else if (event.key === "Tab" && !event.shiftKey && open.value && hooks.complete?.()) {
      event.preventDefault();
    }
  }

  return { items, showingRecent, status, open, highlighted, moved, current, ask, show, close, cancel, remember, highlight, keydown };
}

export type Suggestions<Value extends string | number> = ReturnType<typeof useSuggestions<Value>>;
