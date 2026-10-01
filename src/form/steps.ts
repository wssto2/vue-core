import { computed, inject, onBeforeUnmount, ref, shallowReactive, toValue, watch, type ComputedRef, type MaybeRefOrGetter, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { matchedRouteKey, onBeforeRouteLeave } from "vue-router";
import type { ErrorBag } from "./errors";
import { useLeaveGuard } from "./leaveGuard";
import { cloneValue } from "./snapshot";
import { readDraft, removeDraft, restoreValues, writeDraft, type StepDraftOptions } from "./stepDraft";
import type { Form, FormFailure, SubmitContext, SubmitOptions } from "./useForm";
import { fieldOfPath } from "./validation";

export type { StepDraftOptions } from "./stepDraft";

/** One step of a step-by-step form. */
export interface StepDefinition<Values extends object, Name extends string = string> {
  /** The step's key: it names the slot of `StepForm` that holds its fields, and what `goTo` takes. */
  readonly name: Name;
  /** Shown in the bar, in "Step 2 of 3 · Vehicle" and as the target of Back and Next. */
  readonly label: string;
  /**
   * The fields of the form this step owns. They are checked (with the form's own validator) before Next, they are what
   * the step's error count counts, and an error the server sends for one of them takes the user back to this step.
   * A step without any (an overview) is never refused.
   */
  readonly fields?: readonly (keyof Values & string)[];
  /** The primary button's text here instead of "Next: <the next step>" ("Confirm"). */
  readonly nextLabel?: string;
  /**
   * Runs once the fields are fine and before the user moves on; resolve false to stay (an async lookup that found nothing:
   * put its message on a field with `form.errors.add`). It must not throw: handle the failure here.
   */
  readonly beforeNext?: () => boolean | Promise<boolean>;
}

export interface StepFormOptions<Values extends object, Output, Name extends string, Saved> {
  /**
   * The steps, in order. A getter or a ref makes them dynamic: they may be added or removed while the flow runs (a step that
   * depends on an answer). The step on screen is kept by its name; when it goes away the user lands on its neighbour, and the
   * steps after the current one are no longer counted as done, since the answers they stood on may have changed.
   */
  readonly steps: MaybeRefOrGetter<readonly StepDefinition<Values, Name>[]>;
  /** Sends the form from the last step's button, like `form.submit`'s. */
  readonly submit: (payload: Output, context: SubmitContext) => Promise<Saved>;
  /** `refresh` and `hydrateFrom` of the submit, as `form.submit` takes them. */
  readonly submitOptions?: SubmitOptions<Values, Saved>;
  /** The form was saved: close the dialog, go to the new record. The draft is already gone. */
  readonly onSaved?: (saved: Saved) => void;
  /** The last step's button; default "Save". */
  readonly submitLabel?: string;
  /** Keeps what was entered across a reload (and removes it on submit and on discard). Opt-in. */
  readonly draft?: StepDraftOptions;
}

/** A step as the progress shows it. */
export interface StepState<Name extends string> {
  readonly name: Name;
  readonly label: string;
  /** 1-based, as shown ("2. Vehicle"). */
  readonly position: number;
  /** `done`: left with its fields fine. `todo`: not reached, or reached and sent back with errors. */
  readonly state: "done" | "current" | "todo";
  /** How many of its fields have an error. */
  readonly errors: number;
  /** Whether the user may go to it from the progress: a step they have been to, or one behind the current. */
  readonly reachable: boolean;
}

/** What `Modal` takes from a flow (`v-bind="flow.bindDialog()"`). */
export interface StepDialogBinding {
  readonly subtitle: string;
  readonly primaryLabel: string;
  readonly status: "idle" | "processing";
  readonly beforeDismiss: () => Promise<boolean>;
}

/** The state and the moves of a step-by-step form (`useStepForm`); `StepForm`, `StepProgress` and `StepNavigation` render it. */
export interface StepFlow<Name extends string> {
  /** Every step with its state, in order. */
  readonly steps: ComputedRef<readonly StepState<Name>[]>;
  readonly current: ComputedRef<StepState<Name>>;
  /** 0-based position of the current step. */
  readonly index: ComputedRef<number>;
  readonly count: ComputedRef<number>;
  readonly isFirst: ComputedRef<boolean>;
  readonly isLast: ComputedRef<boolean>;
  /** A step's check or lookup is running, or the form is being sent. */
  readonly busy: ComputedRef<boolean>;
  /** Which way the last move went (a step slides in from there); null before the first one. */
  readonly direction: Readonly<Ref<"forward" | "back" | null>>;
  /** "Step 2 of 3 · Vehicle", and "· draft saved" once the draft is stored: a dialog's subtitle, or the page's description. */
  readonly subtitle: ComputedRef<string>;
  /** "Next: Review", the step's own `nextLabel`, or the `submitLabel` on the last step. */
  readonly nextLabel: ComputedRef<string>;
  /** The previous step's label ("Customer"), null on the first step. */
  readonly backLabel: ComputedRef<string | null>;
  /** A draft from an earlier visit was put back, and the user has not moved since. */
  readonly restored: Readonly<Ref<boolean>>;
  /** Counts the attempts that were refused (a step with errors, a failed send); `StepForm` moves focus to the first error on each. */
  readonly refusals: Readonly<Ref<number>>;
  /** The form's errors and failure, so `<FormErrors :form="flow" />` works. */
  readonly errors: ErrorBag;
  readonly failure: Readonly<Ref<FormFailure | null>>;
  /**
   * Checks the current step and goes to the next; on the last step it sends the form. Resolves false when the step was
   * refused (its errors are on its fields), a lookup said no, or nothing was saved.
   */
  next(): Promise<boolean>;
  /** One step back. Nothing is checked, and nothing is lost: errors and values stay. */
  back(): void;
  /**
   * Goes to a step. Backwards it just goes; forwards it only goes to a step the user has been to, and checks every step
   * on the way (the user may have changed one meanwhile). Resolves whether it arrived.
   */
  goTo(name: Name): Promise<boolean>;
  /** Back to an empty first step: the form is reset and the draft removed. */
  restart(): void;
  /**
   * Asks "Discard changes?" when there is something to lose, and when the answer is yes (or there was nothing) removes the draft.
   * Pass it as a dialog's `before-dismiss`; a page that leaves by route is asked by the leave guard on its own.
   */
  confirmDiscard(): Promise<boolean>;
  /** Everything a `Modal` takes from the flow: its subtitle, the primary button, the wait, the question before closing. */
  bindDialog(): StepDialogBinding;
}

/**
 * The state of a step-by-step form over a `useForm`: one flow for a fixed list of named steps (a lead in three steps, with a bar) and for
 * steps that depend on answers (an appraisal asks a different number of questions: dots).
 *
 *   const form = useForm({ defaults: emptyLead, validator: leadSchema });
 *   const flow = useStepForm(form, {
 *     steps: [
 *       { name: "customer", label: t("customer"), fields: ["name", "email"] },
 *       { name: "vehicle", label: t("vehicle"), fields: ["make", "budget"] },
 *       { name: "review", label: t("review") },
 *     ],
 *     submit: (payload, { idempotencyKey }) => api.createLead(payload, { idempotencyKey }),
 *     submitLabel: t("create"),
 *     draft: { key: "lead:new" },
 *   });
 *
 * Next checks only the current step's fields; the last step's Next sends the whole form, and what the validator or the server
 * refuses takes the user to the first step with an error. `useStepForm` registers the form's unsaved changes with the leave guard,
 * so it needs a component and the app's guard, like `useResourceForm`.
 */
export function useStepForm<Values extends object, Output, Name extends string, Saved>(
  form: Form<Values, Output>,
  options: StepFormOptions<Values, Output, Name, Saved>,
): StepFlow<Name> {
  const { t } = useI18n();
  const definitions = computed(() => toValue(options.steps));
  if (definitions.value.length === 0) throw new Error("useStepForm: a flow needs at least one step.");

  const currentName = ref(definitions.value[0]!.name) as Ref<Name>;
  const passed = shallowReactive(new Set<Name>());
  // The steps the user has been on, left or not: a step they came back from stays one click away.
  const visited = shallowReactive(new Set<Name>([definitions.value[0]!.name]));
  const direction = ref<"forward" | "back" | null>(null);
  const checking = ref(false);
  const refusals = ref(0);
  const restored = ref(false);
  const draftSaved = ref(false);
  // Finished or discarded: nothing is left to lose or to keep.
  let closed = false;
  let lastIndex = 0;

  const index = computed(() => Math.max(0, definitions.value.findIndex((step) => step.name === currentName.value)));
  const errorsOf = (step: StepDefinition<Values, Name>): number => step.fields?.filter((field) => form.errors.has(field)).length ?? 0;
  const steps = computed<readonly StepState<Name>[]>(() =>
    definitions.value.map((step, at) => {
      const errors = errorsOf(step);
      const here = at === index.value;
      return {
        name: step.name,
        label: step.label,
        position: at + 1,
        state: here ? "current" : passed.has(step.name) && errors === 0 ? "done" : "todo",
        errors,
        reachable: !here && (visited.has(step.name) || at < index.value),
      };
    }),
  );
  const current = computed(() => steps.value[index.value]!);
  const count = computed(() => steps.value.length);
  const isFirst = computed(() => index.value === 0);
  const isLast = computed(() => index.value === count.value - 1);
  const busy = computed(() => checking.value || form.submitting.value);

  function move(to: number) {
    const target = definitions.value[to];
    if (!target) return;
    direction.value = to > index.value ? "forward" : "back";
    currentName.value = target.name;
    visited.add(target.name);
    lastIndex = to;
    restored.value = false;
  }

  // Dynamic steps: keep the user on their step by name; if it went away, on the one that took its place.
  watch(
    () => definitions.value.map((step) => step.name).join("\u0000"),
    () => {
      const list = definitions.value;
      const at = list.findIndex((step) => step.name === currentName.value);
      const here = at === -1 ? Math.min(lastIndex, list.length - 1) : at;
      currentName.value = list[here]!.name;
      lastIndex = here;
      list.forEach((step, position) => {
        if (position > here) {
          passed.delete(step.name);
          visited.delete(step.name);
        }
      });
      visited.add(currentName.value);
      for (const set of [passed, visited]) for (const name of [...set]) if (!list.some((step) => step.name === name)) set.delete(name);
    },
  );

  /**
   * `form.check` for this step's fields without losing the other steps' errors (it replaces all of them): what a server sent for an
   * earlier step, or the validator said on the last attempt, stays on that step.
   */
  function checkStep(step: StepDefinition<Values, Name>): boolean {
    const fields = step.fields as readonly string[] | undefined;
    if (!fields?.length) return true;
    const others = Object.entries(form.errors.all()).filter(([path]) => !fields.includes(fieldOfPath(path)));
    const fine = form.check(step.fields!);
    if (others.length > 0) form.errors.set({ ...Object.fromEntries(others), ...form.errors.all() });
    return fine;
  }

  async function leave(step: StepDefinition<Values, Name>): Promise<boolean> {
    if (!checkStep(step)) {
      refusals.value++;
      return false;
    }
    if (!step.beforeNext) return true;
    checking.value = true;
    try {
      if (await step.beforeNext()) return true;
    } finally {
      checking.value = false;
    }
    refusals.value++;
    return false;
  }

  async function send(): Promise<boolean> {
    const result = await form.submit(options.submit, options.submitOptions);
    if (result.status === "saved" || result.status === "saved-refresh-failed") {
      closed = true;
      dropDraft();
      options.onSaved?.(result.value);
      return true;
    }
    if (result.status === "failed") {
      refusals.value++;
      // The validator or the server refused fields of an earlier step: take the user to the first one, unless they are already looking at errors.
      if (current.value.errors === 0) {
        const at = steps.value.findIndex((step) => step.errors > 0);
        if (at !== -1) move(at);
      }
    }
    return false;
  }

  async function next(): Promise<boolean> {
    if (busy.value) return false;
    const step = definitions.value[index.value]!;
    if (!(await leave(step))) return false;
    passed.add(step.name);
    if (index.value < count.value - 1) {
      move(index.value + 1);
      return true;
    }
    return send();
  }

  async function goTo(name: Name): Promise<boolean> {
    if (busy.value) return false;
    const target = definitions.value.findIndex((step) => step.name === name);
    if (target === -1) return false;
    if (target <= index.value) {
      if (target < index.value) move(target);
      return true;
    }
    if (!visited.has(name)) return false;
    while (index.value < target) if (!(await next())) return false;
    return index.value === target;
  }

  // ---- the draft
  const draft = options.draft;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function persist() {
    timer = undefined;
    if (!draft || closed) return;
    if (!form.dirty.value) {
      removeDraft(draft);
      draftSaved.value = false;
      return;
    }
    draftSaved.value = writeDraft(draft, { values: cloneValue(form.values) as Record<string, unknown>, step: currentName.value, passed: [...passed] });
  }
  function dropDraft() {
    closed = true;
    clearTimeout(timer);
    timer = undefined;
    draftSaved.value = false;
    if (draft) removeDraft(draft);
  }

  if (draft) {
    const stored = readDraft(draft);
    if (stored) {
      restoreValues(form.values as Record<string, unknown>, stored.values);
      const names = definitions.value.map((step) => step.name as string);
      if (names.includes(stored.step)) currentName.value = stored.step as Name;
      for (const name of stored.passed) if (names.includes(name)) passed.add(name as Name);
      for (const name of [...passed, currentName.value]) visited.add(name);
      lastIndex = index.value;
      restored.value = form.dirty.value;
      draftSaved.value = restored.value;
    }
    watch(
      [() => form.values, currentName, () => [...passed].join("\u0000")],
      () => {
        if (closed) return;
        clearTimeout(timer);
        timer = setTimeout(persist, 400);
      },
      { deep: true },
    );
    // Leaving with an edit still waiting for its turn keeps it.
    onBeforeUnmount(() => {
      if (timer !== undefined) {
        clearTimeout(timer);
        persist();
      }
    });
  }

  // ---- discarding
  const { confirmDiscard: ask } = useLeaveGuard(() => !closed && form.dirty.value);
  // Behind the leave guard's own: it only gets here once the user agreed to leave (or had nothing to lose).
  if (inject(matchedRouteKey, null)) {
    onBeforeRouteLeave(() => {
      if (!closed) dropDraft();
      return true;
    });
  }

  async function confirmDiscard(): Promise<boolean> {
    const leaving = await ask();
    if (leaving) dropDraft();
    return leaving;
  }

  function restart() {
    form.reset();
    passed.clear();
    visited.clear();
    direction.value = null;
    currentName.value = definitions.value[0]!.name;
    visited.add(currentName.value);
    lastIndex = 0;
    restored.value = false;
    dropDraft();
    closed = false;
  }

  const subtitle = computed(() => {
    const parts = [t("core.steps.position", { current: index.value + 1, total: count.value }), current.value.label];
    if (draftSaved.value) parts.push(t("core.steps.draft_saved"));
    return parts.join(" · ");
  });
  const nextLabel = computed(() => {
    const step = definitions.value[index.value]!;
    if (step.nextLabel) return step.nextLabel;
    if (isLast.value) return options.submitLabel ?? t("core.actions.save");
    return t("core.steps.next_named", { step: definitions.value[index.value + 1]!.label });
  });
  const backLabel = computed(() => (isFirst.value ? null : definitions.value[index.value - 1]!.label));

  return {
    steps,
    current,
    index,
    count,
    isFirst,
    isLast,
    busy,
    direction,
    subtitle,
    nextLabel,
    backLabel,
    restored,
    refusals,
    errors: form.errors,
    failure: form.failure,
    next,
    back: () => move(index.value - 1),
    goTo,
    restart,
    confirmDiscard,
    bindDialog: () => ({ subtitle: subtitle.value, primaryLabel: nextLabel.value, status: busy.value ? "processing" : "idle", beforeDismiss: confirmDiscard }),
  };
}
