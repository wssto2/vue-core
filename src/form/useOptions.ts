import { computed, onScopeDispose, watch } from "vue";
import type { SelectOption } from "./options";
import { useLatestLoad, type SuggestionStatus } from "./suggestions";

/**
 * The options of a select that arrive from the server. `status` is the state of the wait, `options` the last answer that
 * landed (kept while the next is loading, so the chosen option keeps its label). Pass it where a list goes:
 * `<SelectField :options="models" />`, `<MultiSelectField :options="models" />`.
 */
export interface AsyncOptions<Value extends string | number = string | number> {
  /** `idle`: nothing to ask yet (the input this depends on is empty). */
  readonly status: SuggestionStatus;
  readonly options: readonly SelectOption<Value>[];
  /**
   * Counts how often the input these options depend on moved away from a value (the user picked another make). A field clears
   * a value the options lack only when options land for a newer generation: never on the first load (a saved value the list no
   * longer offers stays), never on a `reload()` of the same input.
   */
  readonly generation: number;
  /** Asks again for the current input (the "Try again" row of a failed load). */
  reload(): void;
}

/** What a select takes as its options: a list, or one that loads. */
export type OptionsSource<Value extends string | number> = readonly SelectOption<Value>[] | AsyncOptions<Value>;

export interface OptionsContext {
  /** Aborted when a newer ask replaced this one or the scope ended: pass it on to the request. */
  readonly signal: AbortSignal;
}

/**
 * Options loaded from the server, with the race rules built in: the latest input wins, an answer for an older input is dropped
 * (and its request aborted), nothing lands after the scope ended. A select given these shows a spinner while it loads, a
 * "Loading…" row when opened, a "Try again" row when it failed, and clears a value the new options do not contain.
 *
 *   const makes = useOptions({ load: (context) => api.makes(context) });
 *   const models = useOptions({ for: () => form.values.make, load: (make, context) => api.models(make, context) });
 *   <SelectField v-bind="form.bind('make')" :label="t('make')" :options="makes" />
 *   <SelectField v-bind="form.bind('model')" :label="t('model')" :options="models" :disabled="!form.values.make" />
 *
 * `for` is a getter of the input the options depend on (reactive); `null` or `undefined` asks nothing (the list is empty, `idle`), anything
 * else asks, again whenever it changes. Without `for` the options load once.
 */
export function useOptions<Input, Value extends string | number>(options: {
  readonly for: () => Input | null | undefined;
  readonly load: (input: Input, context: OptionsContext) => Promise<readonly SelectOption<Value>[]>;
}): AsyncOptions<Value>;
export function useOptions<Value extends string | number>(options: {
  readonly load: (context: OptionsContext) => Promise<readonly SelectOption<Value>[]>;
}): AsyncOptions<Value>;
export function useOptions<Input, Value extends string | number>(options: {
  readonly for?: () => Input | null | undefined;
  readonly load: ((context: OptionsContext) => Promise<readonly SelectOption<Value>[]>) | ((input: Input, context: OptionsContext) => Promise<readonly SelectOption<Value>[]>);
}): AsyncOptions<Value> {
  const latest = useLatestLoad<SelectOption<Value>>();
  const dependent = options.for !== undefined;
  let generation = 0;

  function ask() {
    const input = options.for?.();
    if (dependent && (input === null || input === undefined)) {
      latest.cancel();
      latest.items.value = [];
      latest.status.value = "idle";
      return;
    }
    void latest.run((signal) =>
      dependent ? (options.load as (input: Input, context: OptionsContext) => Promise<readonly SelectOption<Value>[]>)(input as Input, { signal }) : (options.load as (context: OptionsContext) => Promise<readonly SelectOption<Value>[]>)({ signal }),
    );
  }

  watch(
    () => options.for?.(),
    (_input, before) => {
      // From a value to another (or to none): what was chosen belonged to the old input. From none to a first value it did not (a record being hydrated).
      if (before !== null && before !== undefined) generation++;
      ask();
    },
    { immediate: true },
  );
  onScopeDispose(latest.cancel);

  return {
    get status() {
      return latest.status.value;
    },
    get options() {
      return latest.items.value;
    },
    get generation() {
      return generation;
    },
    reload: ask,
  };
}

const isList = <Value extends string | number>(source: OptionsSource<Value>): source is readonly SelectOption<Value>[] => Array.isArray(source);

const WITHOUT_OPTIONS: readonly SelectOption<never>[] = [];

/**
 * What a select makes of its `options` prop, a list or a loader: the options known (also the stale ones while loading, so the
 * chosen label stays), the rows to list (none while loading or failed), the status for the control and the list, and `arrived`,
 * called with the new options when a load lands for a different input than the one the value belongs to (the user picked
 * another make, or emptied it), so the field can drop a value they do not contain. The first load and a reload of the same
 * input never call it.
 */
export function useOptionSource<Value extends string | number>(source: () => OptionsSource<Value>, arrived: (options: readonly SelectOption<Value>[]) => void) {
  const known = computed<readonly SelectOption<Value>[]>(() => {
    const current = source();
    return isList(current) ? current : current.options;
  });
  const status = computed<SuggestionStatus>(() => {
    const current = source();
    return isList(current) ? "loaded" : current.status;
  });
  const rows = computed(() => (status.value === "loading" || status.value === "failed" ? WITHOUT_OPTIONS : known.value));
  const loading = computed(() => status.value === "loading");

  // The generation the value belongs to: the one the field was made in.
  const first = source();
  let owned = isList(first) ? 0 : first.generation;
  watch(
    () => {
      const current = source();
      if (isList(current)) return null;
      return current.status === "loaded" || current.status === "idle" ? current.options : null;
    },
    (landed) => {
      const current = source();
      if (landed === null || isList(current) || current.generation === owned) return;
      owned = current.generation;
      arrived(landed);
    },
  );

  return { known, rows, status, loading, reload: () => { const current = source(); if (!isList(current)) current.reload(); } };
}
