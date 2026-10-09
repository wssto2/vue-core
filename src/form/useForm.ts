import { computed, reactive, ref, shallowRef, type ComputedRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { isAborted, isApiError } from "../client";
import { useAppFieldErrorDescriber } from "../i18n/describeError";
import { ErrorBag } from "./errors";
import { cloneValue, sameValue } from "./snapshot";
import { fieldOfPath, issuesToMessages, type FieldMessages, type FormValidator } from "./validation";

/** What a field component needs to be bound to one value of a form: spread it with `v-bind`. */
export interface FieldBinding<Value> {
  readonly modelValue: Value;
  readonly "onUpdate:modelValue": (value: Value) => void;
  /** The first message of the field, or of a value inside it. */
  readonly error: string | undefined;
  /** Marks the rendered field, so an error whose field is not on screen can be told apart (`FormErrors`). */
  readonly "data-field-key": string;
}

/** What `MonthYearField` needs: a month and a year, two numbers of the form. */
export interface MonthYearBinding {
  readonly month: number | null;
  readonly year: number | null;
  readonly "onUpdate:month": (value: number | null) => void;
  readonly "onUpdate:year": (value: number | null) => void;
  readonly error: string | undefined;
  /** Both keys, so an error on either counts as shown. */
  readonly "data-field-key": string;
}

/** The keys of `Values` that hold exactly `Held`. */
export type KeysHolding<Values, Held> = { [Key in keyof Values & string]: [Values[Key]] extends [Held] ? ([Held] extends [Values[Key]] ? Key : never) : never }[keyof Values & string];

/**
 * Why a submit did not succeed, as a closed set:
 *
 * - `invalid`: the input was refused, by the validator or by the server (422); the messages are on the fields.
 * - `conflict` (409): the endpoint says the record or its state moved on. What that means is the feature's call: only an endpoint documented as "stale record" is rebased.
 * - `forbidden` (403) and `unauthorized` (401, the session expired): told apart, since neither is fixed by editing.
 * - `offline`: no answer at all. `failed`: anything else the server or the code threw.
 * - `refresh`: the save went through, but reading the result back failed (see `SubmitResult`).
 */
export type FormFailureKind = "invalid" | "conflict" | "forbidden" | "unauthorized" | "offline" | "failed" | "refresh";

export interface FormFailure {
  readonly kind: FormFailureKind;
  /** A sentence for the person, in the app's language. */
  readonly message: string;
  /** The request id of the failed exchange, to quote in a bug report. */
  readonly requestId: string | null;
  /** What was thrown; null for a validator refusal. */
  readonly error: unknown;
}

/** What `send` receives next to the payload. */
export interface SubmitContext {
  /** Sent as `Idempotency-Key`: the same for the duplicate clicks of one attempt, new after every settled attempt. */
  readonly idempotencyKey: string;
}

/**
 * How a submit ended:
 *
 * - `saved`: done; the draft is the new baseline.
 * - `saved-refresh-failed`: the save **went through** but `refresh` failed. The draft is the new baseline (saving again would repeat the mutation); `form.failure` says `refresh`.
 * - `failed`: nothing was saved; the draft is kept exactly as it was, so the user can fix it or retry.
 * - `aborted`: the request was cancelled, which is not a failure.
 */
export type SubmitResult<Saved> =
  | { readonly status: "saved"; readonly value: Saved }
  | { readonly status: "saved-refresh-failed"; readonly value: Saved; readonly error: unknown }
  | { readonly status: "failed"; readonly failure: FormFailure }
  | { readonly status: "aborted" };

export interface SubmitOptions<Values, Saved> {
  /** Reads the result back after a save (reloads the record). Its failure does not undo the save: see `saved-refresh-failed`. */
  readonly refresh?: (saved: Saved) => Promise<unknown> | unknown;
  /** Values the form takes over from what the save returned (the record as the server stored it): they become draft and baseline. Default: the submitted draft is the baseline. */
  readonly hydrateFrom?: (saved: Saved) => Values | null;
}

export interface FormOptions<Values extends object, Output = Values> {
  /** The values of an empty form. A function gives every form its own copy. */
  readonly defaults: Values | (() => Values);
  /** The app's schema (anything with Zod's `safeParse`). Without one the server is the only validator. */
  readonly validator?: FormValidator<Output>;
  /** A field message into a sentence, for a form that says it differently from the rest of the app. Default: the application's (`createApplication({ describeFieldError })`), else as sent. */
  readonly describeFieldError?: (message: string, field: string) => string;
  /** The draft's name for a field the server names, given the whole dotted path (`tax_id` is `taxId`, `lines.0.unit_price` is `lines.0.unitPrice`). Default: the same name. */
  readonly serverField?: (field: string) => string;
  /** The sentence for a failure; return undefined for the library's default of that kind. */
  readonly failureMessage?: (kind: FormFailureKind, error: unknown) => string | undefined;
}

type Fields<Values> = readonly (keyof Values & string)[];

export interface Form<Values extends object, Output = Values> {
  /** The draft: what the fields edit. A reactive object, read and assigned like any other (`form.values.email`). */
  readonly values: Values;
  readonly errors: ErrorBag;
  /** Whether the draft differs from the baseline (what was loaded or last saved). */
  readonly dirty: ComputedRef<boolean>;
  readonly submitting: Readonly<Ref<boolean>>;
  /** Why the last submit failed, until the next one starts (or `dismissFailure`). */
  readonly failure: Readonly<Ref<FormFailure | null>>;
  /** The value, the error and the marker of one field: `<TextField v-bind="form.bind('email')" />`. Misspelled names and wrong value types are compile errors. */
  bind<Key extends keyof Values & string>(key: Key): FieldBinding<Values[Key]>;
  /** The two number fields of a month and a year, for `MonthYearField`: `<MonthYearField v-bind="form.bindMonthYear('regMonth', 'regYear')" />`. */
  bindMonthYear<MonthKey extends KeysHolding<Values, number | null>, YearKey extends KeysHolding<Values, number | null>>(monthKey: MonthKey, yearKey: YearKey): MonthYearBinding;
  /** Takes new values as both draft and baseline and clears errors and the failure: a record was loaded. */
  hydrate(next: Values): void;
  /** Puts the baseline back in the draft and clears errors and the failure (Cancel). */
  reset(): void;
  /** Takes the draft as the baseline (defaults applied right after loading are not the user's edits). */
  markClean(): void;
  /** Runs the validator on a copy of the draft: the errors are set and null returned, or the parsed output. */
  validate(): Output | null;
  /** Like `validate` for the given fields only: the validator's issues elsewhere are ignored (a group saving to its own endpoint). True when they are fine. */
  check(fields: Fields<Values>): boolean;
  /**
   * Validates and sends the whole form. One attempt at a time: a second call while one is in flight
   * returns the same promise. A failed attempt keeps the draft; server validation answers land on the fields.
   *
   *   const result = await form.submit((payload, { idempotencyKey }) => api.create(payload, { idempotencyKey }));
   */
  submit<Saved>(send: (payload: Output, context: SubmitContext) => Promise<Saved>, options?: SubmitOptions<Values, Saved>): Promise<SubmitResult<Saved>>;
  /**
   * Validates and sends only some fields, to an endpoint of their own: `send` receives exactly those
   * values, as drafted (not the validator's output). The other fields are not sent and not judged.
   */
  submitFields<Keys extends Fields<Values>, Saved>(
    fields: Keys,
    send: (changes: Pick<Values, Keys[number]>, context: SubmitContext) => Promise<Saved>,
    options?: SubmitOptions<Values, Saved>,
  ): Promise<SubmitResult<Saved>>;
  dismissFailure(): void;
}

const newKey = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * The state of a form: typed values, typed `bind`, validation by the app's schema, server errors on
 * their fields, a dirty baseline and a guarded submit.
 *
 *   const form = useForm({ defaults: () => ({ name: "", age: null as number | null }), validator: ticketSchema });
 *   <TextField v-bind="form.bind('name')" :label="t('name')" />
 *   <NumberField v-bind="form.bind('age')" />       // bind('nam') or a wrong value type does not compile
 *
 * `Values` (the draft, what fields edit) comes from `defaults`; `Output` (what the server receives)
 * from the validator, so a schema that turns "" into null or text into a number is honest in the types.
 */
export function useForm<Values extends object, Output = Values>(options: FormOptions<Values, Output>): Form<Values, Output> {
  const { t } = useI18n();
  const describeFieldError = options.describeFieldError ?? useAppFieldErrorDescriber();
  const initial = (): Values => cloneValue(typeof options.defaults === "function" ? (options.defaults as () => Values)() : options.defaults);

  const values = reactive(initial() as object) as Values;
  const baseline = shallowRef<Values>(cloneValue(values));
  const errors = new ErrorBag();
  const submitting = ref(false);
  const failure = shallowRef<FormFailure | null>(null);
  const dirty = computed(() => !sameValue(values, baseline.value));

  let inFlight: Promise<SubmitResult<unknown>> | null = null;
  let key = newKey();

  function assign(next: Values) {
    const target = values as Record<string, unknown>;
    for (const name of Object.keys(target)) if (!(name in next)) delete target[name];
    Object.assign(target, cloneValue(next));
  }

  function clearOutcome() {
    errors.clear();
    failure.value = null;
  }

  function fail(kind: FormFailureKind, error: unknown): FormFailure {
    const requestId = isApiError(error) ? error.requestId : null;
    const message = options.failureMessage?.(kind, error) ?? t(`core.form.failure.${kind}`);
    return (failure.value = { kind, message, requestId, error });
  }

  function place(messages: FieldMessages, fromServer = false) {
    const { serverField } = options;
    const translate = describeFieldError;
    const named = fromServer && serverField ? Object.entries(messages).map(([field, list]) => [serverField(field), list] as const) : Object.entries(messages);
    errors.set(Object.fromEntries(translate ? named.map(([field, list]) => [field, list.map((message) => translate(message, field))]) : named));
  }

  function validate(): Output | null {
    errors.clear();
    if (!options.validator) return cloneValue(values) as unknown as Output;
    // The validator works on a copy: its transforms never rewrite what the user typed.
    const result = options.validator.safeParse(cloneValue(values));
    if (result.success) return result.data;
    place(issuesToMessages(result.error.issues));
    return null;
  }

  function check(fields: Fields<Values>): boolean {
    errors.clear();
    if (!options.validator) return true;
    const result = options.validator.safeParse(cloneValue(values));
    if (result.success) return true;
    const own = Object.fromEntries(Object.entries(issuesToMessages(result.error.issues)).filter(([path]) => (fields as readonly string[]).includes(fieldOfPath(path))));
    place(own);
    return Object.keys(own).length === 0;
  }

  function classify(error: unknown): FormFailureKind {
    if (!isApiError(error)) return "failed";
    switch (error.kind) {
      case "validation":
        return "invalid";
      case "conflict":
        return "conflict";
      case "forbidden":
        return "forbidden";
      case "unauthorized":
        return "unauthorized";
      case "network":
        return "offline";
      default:
        return "failed";
    }
  }

  // One attempt: the payload is prepared (or the attempt is refused), sent, settled. `settled` moves the baseline.
  async function attempt<Payload, Saved>(
    prepare: () => Payload | null,
    send: (payload: Payload, context: SubmitContext) => Promise<Saved>,
    settled: (saved: Saved, submitted: Values) => void,
    submitOptions: SubmitOptions<Values, Saved> | undefined,
  ): Promise<SubmitResult<Saved>> {
    if (inFlight) return inFlight as Promise<SubmitResult<Saved>>;
    const run = async (): Promise<SubmitResult<Saved>> => {
      failure.value = null;
      const payload = prepare();
      if (payload === null) return { status: "failed", failure: fail("invalid", null) };
      const submitted = cloneValue(values);
      let saved: Saved;
      submitting.value = true;
      try {
        saved = await send(payload, { idempotencyKey: key });
      } catch (error) {
        submitting.value = false;
        if (isAborted(error)) return { status: "aborted" };
        const kind = classify(error);
        if (kind === "invalid" && isApiError(error)) place(error.fields, true);
        return { status: "failed", failure: fail(kind, error) };
      }
      const hydrated = submitOptions?.hydrateFrom?.(saved) ?? null;
      if (hydrated) {
        assign(hydrated);
        baseline.value = cloneValue(hydrated);
        errors.clear();
      } else settled(saved, submitted);
      try {
        await submitOptions?.refresh?.(saved);
      } catch (error) {
        fail("refresh", error);
        return { status: "saved-refresh-failed", value: saved, error };
      } finally {
        submitting.value = false;
      }
      return { status: "saved", value: saved };
    };
    const running = run().finally(() => {
      inFlight = null;
      // A deliberate retry after a settled attempt gets a fresh key: the server's idempotency cache would otherwise replay a failure.
      key = newKey();
    });
    inFlight = running;
    return running;
  }

  return {
    values,
    errors,
    dirty,
    submitting,
    failure,
    bind<Key extends keyof Values & string>(field: Key): FieldBinding<Values[Key]> {
      return {
        get modelValue() {
          return values[field];
        },
        "onUpdate:modelValue"(value: Values[Key]) {
          values[field] = value;
          errors.clear(field); // a message counts down while the user fixes the field
        },
        get error() {
          return errors.first(field);
        },
        "data-field-key": field,
      };
    },
    bindMonthYear(monthKey, yearKey) {
      const numbers = values as Record<string, number | null>;
      return {
        get month() {
          return numbers[monthKey] ?? null;
        },
        get year() {
          return numbers[yearKey] ?? null;
        },
        "onUpdate:month"(value) {
          numbers[monthKey] = value;
          errors.clear(monthKey);
        },
        "onUpdate:year"(value) {
          numbers[yearKey] = value;
          errors.clear(yearKey);
        },
        get error() {
          return errors.first(monthKey) ?? errors.first(yearKey);
        },
        "data-field-key": `${monthKey} ${yearKey}`,
      };
    },
    hydrate(next) {
      assign(next);
      baseline.value = cloneValue(next);
      clearOutcome();
    },
    reset() {
      assign(baseline.value);
      clearOutcome();
    },
    markClean() {
      baseline.value = cloneValue(values);
    },
    validate,
    check,
    submit: (send, submitOptions) =>
      attempt(validate, send, (_saved, submitted) => (baseline.value = submitted), submitOptions),
    submitFields: (fields, send, submitOptions) =>
      attempt(
        () => (check(fields) ? (Object.fromEntries(fields.map((field) => [field, cloneValue(values[field])])) as Pick<Values, (typeof fields)[number]>) : null),
        send,
        (_saved, submitted) => {
          const next = cloneValue(baseline.value);
          for (const field of fields) next[field] = cloneValue(submitted[field]);
          baseline.value = next;
        },
        submitOptions,
      ),
    dismissFailure() {
      failure.value = null;
    },
  };
}
