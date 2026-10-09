import { computed, getCurrentScope, onScopeDispose, shallowRef, watch, type ComputedRef, type WatchSource } from "vue";
import { useI18n } from "vue-i18n";
import { useDescribeError } from "../i18n/describeError";
import type { AsyncState } from "./async";

export interface LoadContext {
  /** Aborted when the load is no longer wanted: a newer load or an `update` superseded it, the watch source changed, the scope ended. */
  readonly signal: AbortSignal;
  /**
   * Ends this load with nothing to show and nothing to report, for a page that is leaving instead (a 403 that
   * redirects): the state stays as it is (loading, or the value on screen) and no error flashes on the way out.
   *
   *   if (isForbidden(error)) { void router.replace(elsewhere); return abandon(); }
   */
  readonly abandon: () => never;
}

/** Thrown by `abandon()`; caught by the load it belongs to. */
const abandoned = Symbol("vue-core.load.abandoned");

export interface LoadOptions {
  /**
   * Load again, from nothing, whenever this changes: the thing shown is another one (a route parameter, a
   * selected tab). The previous value is cleared (`loading`), because it belongs to what was left.
   */
  readonly watch?: WatchSource<unknown> | readonly WatchSource<unknown>[];
  /** Load at once (default true); false waits for `reload()` or a change of the watch source. */
  readonly immediate?: boolean;
  /** The text of a failed load; by default `describeError` with "An error occurred while loading data". */
  readonly errorMessage?: (error: unknown) => string;
}

/** What `useLoad` gives: the `AsyncState` (so `AsyncSection` takes it as it is) and the two ways to change it. */
export interface Load<T> {
  readonly state: ComputedRef<AsyncState<T>>;
  /** The loaded value, null while loading or failed. */
  readonly data: ComputedRef<T | null>;
  /** Loads again, keeping the value on screen (`refreshing`, or `stale` when it failed); settles when the load has ended (applied or dropped). */
  reload(): Promise<void>;
  /** Replaces the value with what a mutation returned (no request) and drops every load still in flight, so none can bring back an older state. */
  update(value: T): void;
}

/**
 * One load for a region that has no identity of its own: a list, the settings of a page, a block of
 * a record page. (`useResource` is the same for a record read by id; `useCollection` for a paged,
 * filtered list.) Latest wins: a load that was left behind is aborted and its answer dropped, and
 * nothing lands after the scope ended.
 *
 *   const settings = useLoad(({ signal }) => api.settings({ signal }));
 *   <AsyncSection :state="settings.state.value" @retry="settings.reload()">
 *     <template #default="{ value }"><SettingsForm :settings="value" /></template>
 *   </AsyncSection>
 *
 * With `watch` it starts over when a source changes (`{ watch: () => route.params.id }`).
 */
export function useLoad<T>(load: (context: LoadContext) => Promise<T>, options: LoadOptions = {}): Load<T> {
  const { t } = useI18n();
  const describeError = useDescribeError();
  const messageOf = options.errorMessage ?? ((error: unknown) => describeError(error, { fallback: t("core.resource.unavailable") }));

  const state = shallowRef<AsyncState<T>>({ status: "loading" });
  let version = 0;
  let reading: AbortController | null = null;

  function supersede(): number {
    reading?.abort();
    reading = null;
    return ++version;
  }

  async function read(): Promise<void> {
    const current = supersede();
    const previous = state.value;
    const keep = "value" in previous ? previous : null;
    state.value = keep ? { status: "refreshing", value: keep.value } : { status: "loading" };
    const own = new AbortController();
    reading = own;
    try {
      const value = await load({ signal: own.signal, abandon });
      if (current === version) state.value = { status: "loaded", value };
    } catch (error) {
      if (current !== version || error === abandoned) return;
      const message = messageOf(error);
      state.value = keep ? { status: "stale", value: keep.value, error: message } : { status: "failed", error: message };
    }
  }

  function abandon(): never {
    throw abandoned;
  }

  function update(value: T): void {
    supersede();
    state.value = { status: "loaded", value };
  }

  function start(): void {
    state.value = { status: "loading" }; // another subject: nothing of the previous one stays
    void read();
  }

  if (options.watch !== undefined) watch(options.watch as WatchSource<unknown>, start, { immediate: options.immediate ?? true });
  else if (options.immediate ?? true) void read();
  if (getCurrentScope()) onScopeDispose(supersede);

  return {
    state: computed(() => state.value),
    data: computed(() => ("value" in state.value ? state.value.value : null)),
    reload: read,
    update,
  };
}
