import { ref, type Ref } from "vue";
import type { IconName } from "../icon";
import { useForm, type Form, type FormOptions, type SubmitContext, type SubmitResult } from "./useForm";

/** The question a command asks before it runs: it names the consequence ("Archive the vehicle?"), and `confirmLabel` says exactly what yes does. */
export interface CommandQuestion {
  readonly title: string;
  readonly message?: string;
  readonly confirmLabel?: string;
  /** The alert's icon, as on `AlertDialog` (an app-registered or core icon name); by default the tone's. */
  readonly icon?: IconName;
  readonly tone?: "neutral" | "warning" | "critical";
}

export interface CommandOptions<Values extends object, Output = Values, Done = unknown> extends FormOptions<Values, Output> {
  /** The call: one purpose-specific endpoint (advance a status, assign, approve, change a price). Its payload is the validator's output. */
  readonly run: (input: Output, context: SubmitContext) => Promise<Done>;
  /** After the call went through: the page updates itself (reloads the record, toasts). */
  readonly done?: (result: Done) => Promise<unknown> | unknown;
  /**
   * A question to put after the inputs check out and before anything is sent (an irreversible step): its answer, not the primary action,
   * runs the command. It reads the validated input and whatever the caller holds (what is still unpaid); `null` asks nothing this time.
   * `CommandDialog` presents it; No returns to the filled form, Yes calls with the usual idempotency key.
   */
  readonly ask?: (input: Output) => CommandQuestion | null;
}

export interface Command<Values extends object, Output = Values, Done = unknown> {
  /** The command's inputs: a small form (`command.form.bind('assignee')`). */
  readonly form: Form<Values, Output>;
  /** Whether the command's dialog is open. */
  readonly open: Readonly<Ref<boolean>>;
  /** Opens it with fresh inputs (the defaults, over which `initial` lays what is already known). */
  present(initial?: Partial<Values>): void;
  dismiss(): void;
  /** Validates and calls. One call at a time; a failure keeps the inputs and says why (`form.failure`, field errors on the fields). */
  run(): Promise<SubmitResult<Done>>;
  /** The question waiting for an answer (set by `run()` when `ask` returned one, instead of calling). */
  readonly question: Readonly<Ref<CommandQuestion | null>>;
  /** Answers it: Yes calls (the result is `run()`'s), No sends nothing and keeps the inputs (`aborted`). */
  answer(yes: boolean): Promise<SubmitResult<Done>>;
  /** For `AlertDialog`'s `action`: resolves when the call went through, throws when it did not, so the dialog stays open and `@failed` fires. */
  confirm(): Promise<void>;
}

/**
 * A command: confirm, call one endpoint, show its field errors. The third composition of §7.5: a status change, a reassignment,
 * an approval, a price change: a purpose-specific call with its own confirmation, never a generic field autosave.
 *
 *   const assign = useCommand({
 *     defaults: () => ({ assignee: null as number | null, note: "" }),
 *     validator: assignSchema,
 *     run: (input, { idempotencyKey }) => api.assign(ticket.id, input, { idempotencyKey }),
 *     done: () => ticket.reload(),
 *   });
 *   <CommandDialog :command="assign" :title="t('assign')" :confirm-label="t('assign')"><SelectField v-bind="assign.form.bind('assignee')" … /></CommandDialog>
 *   <Button @click="assign.present()">Assign</Button>
 *
 * `ask: (input) => ({ title, message, confirmLabel, icon, tone }) | null` puts a question before the call (a delivery that archives the vehicle).
 * A command with nothing to enter is an `AlertDialog` with `:action="command.confirm"`.
 */
export function useCommand<Values extends object, Output = Values, Done = unknown>(options: CommandOptions<Values, Output, Done>): Command<Values, Output, Done> {
  const form = useForm<Values, Output>(options);
  const open = ref(false);
  const fresh = (): Values => (typeof options.defaults === "function" ? (options.defaults as () => Values)() : options.defaults);

  const question = ref<CommandQuestion | null>(null);

  async function call(): Promise<SubmitResult<Done>> {
    const result = await form.submit(options.run, {
      // The page updating itself after the call is the refresh: its failure is "saved, but could not be read back".
      refresh: options.done ? (value) => options.done?.(value) : undefined,
    });
    return result;
  }

  async function run(): Promise<SubmitResult<Done>> {
    // An invalid form is not asked about: the call below refuses it and puts the errors on the fields.
    const input = options.ask ? form.validate() : null;
    const asked = input === null ? null : (options.ask?.(input) ?? null);
    if (!asked) return call();
    question.value = asked;
    return { status: "aborted" };
  }

  return {
    form,
    open,
    present(initial) {
      form.hydrate({ ...fresh(), ...initial });
      open.value = true;
    },
    dismiss() {
      open.value = false;
    },
    run,
    question,
    async answer(yes) {
      question.value = null;
      return yes ? call() : { status: "aborted" };
    },
    async confirm() {
      const result = await call();
      if (result.status === "failed") throw new Error(result.failure.message);
      if (result.status === "aborted") throw new Error("aborted");
    },
  };
}
