import { computed, ref, shallowRef, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from "vue";
import { toast } from "../overlay";
import { useLeaveGuard } from "./leaveGuard";
import { cloneValue, sameValue } from "./snapshot";
import type { ErrorBag } from "./errors";
import type { FormFailure, SubmitContext, SubmitOptions, SubmitResult } from "./useForm";
import { fieldOfPath } from "./validation";

type FieldsOf<Values> = readonly (keyof Values & string)[];

/** What a group sheet needs of a record's form: `RecordForm` has it all, `Form` has all but the full-record `save`. */
export interface GroupSheetForm<Values extends object> {
  readonly values: Values;
  readonly errors: ErrorBag;
  readonly failure: Readonly<Ref<FormFailure | null>>;
  dismissFailure(): void;
  submitFields<Keys extends FieldsOf<Values>, Saved>(
    fields: Keys,
    send: (changes: Pick<Values, Keys[number]>, context: SubmitContext) => Promise<Saved>,
    options?: SubmitOptions<Values, Saved>,
  ): Promise<SubmitResult<Saved>>;
  /** The record's full update (`RecordForm.save`). Needed unless the sheet has its own `save`. */
  save?(options?: { readonly refresh?: () => Promise<unknown> | unknown }): Promise<SubmitResult<unknown>>;
  /** Takes the freshly read record as the base, keeping the listed fields of the draft (`RecordForm.rebase`). Needed for `rebase`. */
  rebase?(keep?: FieldsOf<Values>): boolean;
}

export interface GroupSheetOptions<Values extends object, Keys extends FieldsOf<Values>, Group extends string> {
  /** The record's loaded form (`useResourceForm`). */
  readonly form: GroupSheetForm<Values>;
  /** The group the sheet edits: a getter when one sheet serves every group of a record. */
  readonly group: MaybeRefOrGetter<Group>;
  /** The fields the sheet shows and saves. Checked against the form's values. */
  readonly fields: Keys | (() => Keys);
  /** What Cancel puts back; by default `fields`. A record whose fields derive from each other across groups (first registration, model year) restores all of them. */
  readonly restore?: MaybeRefOrGetter<FieldsOf<Values>>;
  /** Which group a field of the record belongs to, to name the group a failed save needs: the page's registry (`provideRecordGroups(…).groupOf`), or your own map. */
  readonly groupOf?: (field: string) => Group | undefined;
  /** The group named for an error on a field no group claims (one the page does not draw). */
  readonly fallbackGroup?: Group;
  /**
   * **A dedicated endpoint for this group**: receives exactly the group's fields, as drafted. Without it the sheet saves the
   * record's **full update** (`form.save()`): the whole valid record with this group's changes, so every rule runs where it
   * always has. The two are never mixed up: a group is not assumed to be partially saveable because it is drawn alone.
   */
  readonly save?: (changes: Pick<Values, Keys[number]>, context: SubmitContext) => Promise<unknown>;
  /** After a save: what else on the page re-reads (the record, a list). Its failure does not undo the save (the sheet tells). */
  readonly onSaved?: () => Promise<unknown> | unknown;
  /**
   * Turns a 409 into a rebase, **only when the endpoint documents a 409 as "your copy is stale"**: re-reads the record,
   * puts the group's edits back on top and asks for a deliberate second Save, with `message`. Without it a 409 is shown as
   * the conflict it is, and nothing is retried (a workflow conflict is the feature's decision).
   */
  readonly rebase?: { readonly reload: () => Promise<unknown>; readonly message: () => string };
}

export interface GroupSheetState<Group extends string> {
  /** Whether the sheet is open. */
  readonly open: Readonly<Ref<boolean>>;
  readonly saving: Readonly<Ref<boolean>>;
  /** Whether the open sheet holds edits that are not saved. */
  readonly dirty: ComputedRef<boolean>;
  /** The groups whose fields the failed save complained about: they cannot be fixed here. */
  readonly foreignGroups: Readonly<Ref<readonly Group[]>>;
  /** What to tell after a stale save was rebased. */
  readonly notice: Readonly<Ref<string | null>>;
  /** The form's failure, for a banner in the sheet. */
  readonly failure: Readonly<Ref<FormFailure | null>>;
  readonly form: Pick<GroupSheetForm<object>, "errors" | "failure">;
  /** Opens the sheet: the group's current values are its baseline. */
  present(): void;
  /** Closes it (after a save); a sheet with unsaved edits asks first. */
  dismiss(): void;
  /** Saves; true when it went through. A sheet does not close itself: `GroupSheet` does, after telling the user. */
  save(): Promise<boolean>;
  /** Asked before every way of closing: resolves false to stay. */
  beforeDismiss(): Promise<boolean>;
  /** The sheet has closed (however it was closed): unsaved edits are put back. */
  closed(): void;
}

/**
 * One group of a record edited in a sheet (decision D22). The sheet's fields bind to the record's loaded form as they do
 * on its page, so their errors show in place; the sheet owns only the lifecycle:
 *
 * - `present()` takes the group's values as the baseline; Cancel (the sheet closing without a save) puts them back: nothing
 *   typed in a sheet survives its Cancel, and a dirty sheet asks before it closes or the page is left.
 * - `save()` sends **the record's full update** by default, or the group to **its own endpoint** (`save`): never inferred.
 * - An error on a field of another group cannot be fixed here: `foreignGroups` names those groups; their errors stay in
 *   the form, so that group's sheet shows them when opened. An error on a field no group claims is listed by `FormErrors`.
 * - A 409 is rebased only where `rebase` says the endpoint means "stale"; a failed save keeps the draft; a save that worked
 *   but whose refresh failed closes the sheet and says so.
 *
 *   const contact = useGroupSheet({ form, group: "contact", fields: ["email", "phone"] as const, reload: … });
 *   <GroupSheet :sheet="contact" :title="t('contact')" :editable="canEdit" :group-label="groupLabel"><FormGroup group="contact">…</FormGroup></GroupSheet>
 */
export function useGroupSheet<Values extends object, const Keys extends FieldsOf<Values>, Group extends string>(options: GroupSheetOptions<Values, Keys, Group>): GroupSheetState<Group> {
  const { form } = options;
  if (options.rebase && !form.rebase) throw new Error("useGroupSheet: `rebase` needs a record form (useResourceForm), which can take the freshly read record as its base.");
  const fieldsNow = (): Keys => (typeof options.fields === "function" ? options.fields() : options.fields);
  const restored = (): FieldsOf<Values> => toValue(options.restore) ?? fieldsNow();

  const open = ref(false);
  const saving = ref(false);
  const foreignGroups = ref<Group[]>([]) as Ref<Group[]>;
  const notice = ref<string | null>(null);
  const baseline = shallowRef<Record<string, unknown>>({});
  let saved: Record<string, unknown> = {};

  const pick = (fields: FieldsOf<Values>): Record<string, unknown> => Object.fromEntries(fields.map((field) => [field, cloneValue(form.values[field])]));
  const dirty = computed(() => open.value && !sameValue(pick(restored()), baseline.value));
  const { confirmDiscard } = useLeaveGuard(() => dirty.value);

  function markBaseline() {
    saved = pick(restored());
    baseline.value = cloneValue(saved);
  }

  function present() {
    markBaseline();
    foreignGroups.value = [];
    notice.value = null;
    form.dismissFailure();
    open.value = true;
  }

  function closed() {
    if (!open.value) return;
    if (dirty.value) Object.assign(form.values, cloneValue(saved));
    for (const field of fieldsNow()) form.errors.clear(field);
    form.dismissFailure();
    open.value = false;
  }

  function foreignFrom(errors: ErrorBag) {
    const own = new Set<string>(fieldsNow());
    const here = toValue(options.group);
    const others = new Set<Group>();
    for (const path of Object.keys(errors.all())) {
      const field = fieldOfPath(path);
      if (own.has(field)) continue;
      const group = options.groupOf?.(field) ?? options.fallbackGroup;
      if (group && group !== here) others.add(group);
    }
    foreignGroups.value = [...others];
  }

  async function rebase(rebasing: NonNullable<GroupSheetOptions<Values, Keys, Group>["rebase"]>) {
    // What the user changed, and only that: a field they did not touch takes the new record's value.
    const mine = cloneValue(pick(fieldsNow().filter((field) => !sameValue(form.values[field], baseline.value[field]))));
    try {
      await rebasing.reload();
    } catch {
      return; // the conflict stays on screen and the draft is untouched: the record could not be read again
    }
    if (!form.rebase?.()) return; // the read failed without throwing (a resource keeps its old value): the same
    // The freshly read values are what the group is compared with; the user's edits go back on top.
    markBaseline();
    Object.assign(form.values, mine);
    notice.value = rebasing.message();
  }

  async function save(): Promise<boolean> {
    if (saving.value) return false;
    saving.value = true;
    foreignGroups.value = [];
    notice.value = null;
    try {
      const refresh = options.onSaved ? () => options.onSaved?.() : undefined;
      let result: SubmitResult<unknown>;
      if (options.save) result = await form.submitFields(fieldsNow(), options.save, { refresh });
      else if (form.save) result = await form.save({ refresh });
      else throw new Error("useGroupSheet: the form has no full-record save(), so give the sheet its own `save` for a dedicated endpoint.");

      switch (result.status) {
        case "saved":
          markBaseline();
          return true;
        case "saved-refresh-failed":
          markBaseline();
          toast.warning(form.failure.value?.message ?? "");
          return true;
        case "aborted":
          return false;
        case "failed":
          if (result.failure.kind === "conflict" && options.rebase) await rebase(options.rebase);
          else foreignFrom(form.errors);
          return false;
      }
    } finally {
      saving.value = false;
    }
  }

  return {
    open,
    saving,
    dirty,
    foreignGroups,
    notice,
    failure: form.failure,
    form,
    present,
    dismiss: () => {
      open.value = false;
    },
    save,
    beforeDismiss: confirmDiscard,
    closed,
  };
}
