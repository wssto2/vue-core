import { computed, getCurrentScope, onScopeDispose, shallowRef, toValue, watch, type ComputedRef, type MaybeRefOrGetter } from "vue";
import { useI18n } from "vue-i18n";
import { isApiError } from "../client";
import type { AsyncState } from "../state/async";

/** What an identity is: the number or text a record is addressed by. */
export type ResourceId = string | number;

/**
 * The state of a resource: an `AsyncState` (so `AsyncSection` takes it as it is), whose `failed`
 * also says why: `notFound` (there is no such record, or no identity to ask for: retrying will not
 * help) or `unavailable` (the read failed: retrying may).
 */
export type ResourceState<T> =
  | Exclude<AsyncState<T>, { status: "failed" }>
  | { readonly status: "failed"; readonly error: string; readonly reason: "notFound" | "unavailable" };

/**
 * One thing loaded by its identity. The identity can change (a record pager moving on): the previous
 * value is cleared, a response for an identity that was left is dropped, and a reload of the same
 * identity keeps the value on screen (`refreshing`, or `stale` when it failed).
 */
export interface Resource<T, Id extends ResourceId = number> {
  /** The identity being shown, or null when there is none (a missing or invalid route parameter). */
  readonly id: ComputedRef<Id | null>;
  readonly state: ComputedRef<ResourceState<T>>;
  /** The value of the current identity, null while loading or failed. */
  readonly data: ComputedRef<T | null>;
  /** Reads the current identity again; settles when the read has ended (applied or dropped). */
  reload(): Promise<void>;
  /**
   * Replaces the value with what a save returned (no extra request) and drops every read still in
   * flight. A value of another identity than the one shown (a save that began on a record the user has
   * since left) is ignored: returns false. The value says which one it is through its `id` or `identify`.
   */
  update(value: T): boolean;
}

export interface ResourceContext {
  /** Aborted when the read is no longer wanted: the identity changed, a newer read or an update superseded it, the scope ended. */
  readonly signal: AbortSignal;
}

export interface ResourceOptions<T, Id extends ResourceId = number> {
  /** The identity to load, reactive. Null loads nothing and is `notFound`. */
  readonly for: MaybeRefOrGetter<Id | null>;
  readonly load: (id: Id, context: ResourceContext) => Promise<T>;
  /** Which identity a value belongs to, for `update`; by default its `id`. A value with neither is taken to be the current one. */
  readonly identify?: (value: T) => Id;
  /** The text of a failed read; by default a sentence per kind of failure, in the app's language. */
  readonly errorMessage?: (error: unknown) => string;
}

/** The default identity: a positive safe integer written in digits. */
export function positiveInteger(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

const hasId = (value: unknown): value is { id: ResourceId } => typeof value === "object" && value !== null && "id" in value;

/**
 * Loads one thing for an identity, with the race rules built in: latest read wins, a read for an
 * identity that was left is dropped (and aborted), nothing lands after the scope ended.
 *
 *   const comments = useResource({ for: () => lead.id.value, load: (id, { signal }) => api.comments(id, { signal }) });
 *   <AsyncSection :state="comments.state.value" @retry="comments.reload()">…</AsyncSection>
 *
 * It is the state of a region that loads on its own (a lead's comments, its history): independent of
 * the record's resource, so one failing never blanks the other. `useRouteResource` is the same
 * thing for the record of a page.
 */
export function useResource<T, Id extends ResourceId = number>(options: ResourceOptions<T, Id>): Resource<T, Id> {
  const { t } = useI18n();
  const id = computed(() => toValue(options.for));
  const state = shallowRef<ResourceState<T>>({ status: "loading" });
  // The identity the value in `state` belongs to.
  let held: Id | null = null;
  let version = 0;
  let reading: AbortController | null = null;

  const messageOf =
    options.errorMessage ??
    ((error: unknown) => {
      if (isApiError(error) && error.kind === "network") return t("core.resource.offline");
      if (isApiError(error) && error.kind === "forbidden") return t("core.no_access.body");
      return t("core.resource.unavailable");
    });

  function supersede(): number {
    reading?.abort();
    reading = null;
    return ++version;
  }

  async function read(): Promise<void> {
    const target = id.value;
    const current = supersede();
    if (target === null) {
      held = null;
      state.value = { status: "failed", reason: "notFound", error: t("core.resource.not_found.body") };
      return;
    }

    const keep = held === target && "value" in state.value ? state.value : null;
    if (keep) state.value = { status: "refreshing", value: keep.value };
    else {
      held = null;
      state.value = { status: "loading" };
    }

    const own = new AbortController();
    reading = own;
    try {
      const value = await options.load(target, { signal: own.signal });
      if (current !== version) return;
      held = target;
      state.value = { status: "loaded", value };
    } catch (error) {
      if (current !== version) return;
      if (isApiError(error) && error.kind === "notFound") {
        held = null;
        state.value = { status: "failed", reason: "notFound", error: t("core.resource.not_found.body") };
      } else if (keep) state.value = { status: "stale", value: keep.value, error: messageOf(error) };
      else {
        held = null;
        state.value = { status: "failed", reason: "unavailable", error: messageOf(error) };
      }
    }
  }

  function update(value: T): boolean {
    const target = id.value;
    const identity = options.identify ? options.identify(value) : hasId(value) ? (value.id as Id) : target;
    if (target === null || identity !== target) return false;
    supersede();
    held = target;
    state.value = { status: "loaded", value };
    return true;
  }

  // Synchronously, so a record page's first read starts in its setup and a route change never shows the previous record.
  watch(id, () => void read(), { immediate: true, flush: "sync" });
  if (getCurrentScope()) onScopeDispose(supersede);

  return {
    id,
    state: computed(() => state.value),
    data: computed(() => ("value" in state.value ? state.value.value : null)),
    reload: read,
    update,
  };
}
