// The draft of a step-by-step form, kept in the browser's storage so a reload does not lose it. Every storage
// access can throw (private windows, blocked site data, a full quota): then there simply is no draft.

/** Where and how a flow keeps its draft. */
export interface StepDraftOptions {
  /** Names the draft: one key per flow, and per record when the flow edits one (`"lead:new"`, `"vehicle:" + id`). */
  readonly key: string;
  /** Change it when the form's shape does: a draft of another version is dropped, never restored into the wrong fields. Default 1. */
  readonly version?: number;
  /** `"session"` (default) lives as long as the tab, `"local"` until it is cleared. */
  readonly storage?: "session" | "local";
}

/** What is stored: the values (as JSON, so strings, numbers, booleans, lists and plain objects; not files), and where the user was. */
export interface StoredDraft {
  readonly version: number;
  readonly values: Record<string, unknown>;
  readonly step: string;
  readonly passed: readonly string[];
}

const PREFIX = "vue-core:step-draft:";

function storageOf(options: StepDraftOptions): Storage | null {
  try {
    return (options.storage === "local" ? window.localStorage : window.sessionStorage) ?? null;
  } catch {
    return null;
  }
}

export function readDraft(options: StepDraftOptions): StoredDraft | null {
  try {
    const raw = storageOf(options)?.getItem(PREFIX + options.key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<StoredDraft> | null;
    if (!draft || draft.version !== (options.version ?? 1) || typeof draft.values !== "object" || draft.values === null || typeof draft.step !== "string" || !Array.isArray(draft.passed)) return null;
    return draft as StoredDraft;
  } catch {
    return null;
  }
}

/** Returns whether it was stored. */
export function writeDraft(options: StepDraftOptions, draft: Omit<StoredDraft, "version">): boolean {
  try {
    const storage = storageOf(options);
    if (!storage) return false;
    // A file cannot be kept: it is stored as nothing.
    const keepable = (_key: string, value: unknown) => (typeof Blob !== "undefined" && value instanceof Blob ? null : value);
    storage.setItem(PREFIX + options.key, JSON.stringify({ version: options.version ?? 1, ...draft }, keepable));
    return true;
  } catch {
    return false;
  }
}

export function removeDraft(options: StepDraftOptions): void {
  try {
    storageOf(options)?.removeItem(PREFIX + options.key);
  } catch {
    // nothing stored, nothing to remove
  }
}

/**
 * Puts what was stored into `values`, key by key, only where the key exists and holds the same kind of value
 * (or one of them is empty): a draft never adds fields or puts text into a number.
 */
export function restoreValues(values: Record<string, unknown>, stored: Record<string, unknown>): void {
  for (const [key, current] of Object.entries(values)) {
    if (!(key in stored)) continue;
    const saved = stored[key];
    const sameKind = saved === null || current === null || current === undefined || (typeof saved === typeof current && Array.isArray(saved) === Array.isArray(current));
    if (sameKind) values[key] = saved;
  }
}
