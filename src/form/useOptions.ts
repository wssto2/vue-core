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

  watch(() => options.for?.(), ask, { immediate: true });
  onScopeDispose(latest.cancel);

  return {
    get status() {
      return latest.status.value;
    },
    get options() {
      return latest.items.value;
    },
    reload: ask,
  };
}

const isList = <Value extends string | number>(source: OptionsSource<Value>): source is readonly SelectOption<Value>[] => Array.isArray(source);

const WITHOUT_OPTIONS: readonly SelectOption<never>[] = [];

/**
 * What a select makes of its `options` prop, a list or a loader: the options known (also the stale ones while loading, so the
 * chosen label stays), the rows to list (none while loading or failed), the status for the control and the list, and `arrived`,
 * called with the new options whenever a load lands (or the loader is emptied by its input), so the field can drop a value they
 * do not contain.
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

  watch(
    () => {
      const current = source();
      if (isList(current)) return null;
      return current.status === "loaded" || current.status === "idle" ? current.options : null;
    },
    (landed, before) => {
      // A loader that has not asked anything yet (idle on mount) has nothing to compare a value with.
      if (landed === null || (before === undefined && landed.length === 0 && status.value === "idle")) return;
      arrived(landed);
    },
    { immediate: true },
  );

  return { known, rows, status, loading, reload: () => { const current = source(); if (!isList(current)) current.reload(); } };
}
