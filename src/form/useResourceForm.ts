import { computed, shallowRef, watch, type ComputedRef } from "vue";
import type { Resource, ResourceId } from "../resource";
import { cloneValue } from "./snapshot";
import { useForm, type Form, type FormOptions, type SubmitContext, type SubmitResult } from "./useForm";

/** The part of a `Resource` a record form reads: the loaded record, its state, its identity, and where a saved record goes. */
export type RecordSource<Record> = Pick<Resource<Record, ResourceId>, "id" | "data" | "state" | "update" | "reload">;

export interface RecordFormOptions<Record, Values extends object, Output = Values> extends FormOptions<Values, Output> {
  /** The record the page already loaded (`useRouteResource`). The form never fetches its own copy: it is filled from this one. */
  readonly source: RecordSource<Record>;
  /** The record as draft values: the explicit DTO to values mapping (dates, nulls, lists). */
  readonly toValues: (record: Record) => Values;
  /**
   * Sends the record's update and returns the record as stored. The payload is the validator's output:
   * map it to the endpoint's body here (omitted, null and empty values are yours to state).
   */
  readonly save: (payload: Output, record: Record, context: SubmitContext) => Promise<Record>;
}

export interface RecordForm<Record, Values extends object, Output = Values> extends Form<Values, Output> {
  /** The record the draft belongs to (the last one loaded or saved); null before it loaded. */
  readonly record: ComputedRef<Record | null>;
  /** The record changed under an unsaved draft (a background reload): the draft was kept, `reset` takes the new record. */
  readonly outdated: ComputedRef<boolean>;
  /**
   * Saves the whole record (its full update). On success the returned record replaces the resource's
   * value once, without a further request, and the form takes it as draft and baseline.
   */
  save(options?: { readonly refresh?: (saved: Record) => Promise<unknown> | unknown }): Promise<SubmitResult<Record>>;
  /**
   * After the record was read again: takes the new record as the base and lays the draft of `keep` on top of it (a stale save,
   * rebased). With fields kept the result is dirty: saving stays a deliberate act. Returns false, changing nothing, when the
   * resource does not hold a freshly loaded record (the read failed).
   */
  rebase(keep?: readonly (keyof Values & string)[]): boolean;
}

/**
 * A form over a loaded record: `useForm` that owns nothing it was given. It is filled from the
 * record once (and again for another record); a record that changes under unsaved edits (a background
 * reload) does not replace them; a failed save keeps the draft; a save updates the resource once.
 *
 *   const ticket = useRouteResource({ param: "ticketID", load: api.get });
 *   const form = useResourceForm({
 *     source: ticket, validator: ticketSchema, defaults: emptyTicket,
 *     toValues: (t) => ({ subject: t.subject, dueOn: t.due_on }),
 *     save: (payload, t, { idempotencyKey }) => api.update(t.id, payload, { idempotencyKey }),
 *   });
 */
export function useResourceForm<Record, Values extends object, Output = Values>(options: RecordFormOptions<Record, Values, Output>): RecordForm<Record, Values, Output> {
  const form = useForm<Values, Output>(options);
  const held = shallowRef<Record | null>(null);
  const outdated = shallowRef(false);
  let heldFor: ResourceId | null = null;

  function take(record: Record) {
    held.value = record;
    heldFor = options.source.id.value;
    outdated.value = false;
    form.hydrate(options.toValues(record));
  }

  watch(
    options.source.data,
    (record) => {
      if (!record || record === held.value) return;
      // Another record, or one the user has not touched: take it. Edits in progress stay.
      if (heldFor !== options.source.id.value || !form.dirty.value) take(record);
      else {
        held.value = record;
        outdated.value = true;
      }
    },
    { immediate: true, flush: "sync" },
  );

  async function save(saveOptions?: { readonly refresh?: (saved: Record) => Promise<unknown> | unknown }) {
    return form.submit(
      async (payload, context) => {
        const record = held.value;
        if (!record) throw new Error("useResourceForm: the record is not loaded, so there is nothing to save.");
        return options.save(payload, record, context);
      },
      {
        refresh: saveOptions?.refresh,
        // The saved record is the new truth, unless the user has moved on to another record meanwhile.
        hydrateFrom: (saved) => {
          const previous = held.value;
          held.value = saved; // before the update, so the resource's change is not mistaken for a background reload
          if (!options.source.update(saved)) {
            held.value = previous;
            return null;
          }
          outdated.value = false;
          return options.toValues(saved);
        },
      },
    );
  }

  return {
    ...form,
    record: computed(() => held.value),
    outdated: computed(() => outdated.value),
    save,
    rebase(keep = []) {
      const record = options.source.data.value;
      if (!record || options.source.state.value.status !== "loaded") return false;
      const mine = Object.fromEntries(keep.map((field) => [field, cloneValue(form.values[field])])) as Partial<Values>;
      take(record);
      Object.assign(form.values, mine);
      return true;
    },
    reset() {
      const record = held.value;
      if (record && outdated.value) take(record);
      else form.reset();
    },
  } as RecordForm<Record, Values, Output>;
}
