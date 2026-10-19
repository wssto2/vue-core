import { useI18n } from "vue-i18n";
import { isApiError } from "../client";
import { useFormat } from "../format";
import type { FormFailureKind } from "../form";
import { useDescribeError } from "./describeError";

export interface ServerMessagesOptions {
  /**
   * The namespaces of the keys the server's validator writes (`validation_errors.required`): a field message that starts with one
   * (and a dot) is a key, said with the app's text for it, else the library's `core.<key>`. Default `["validation_errors"]` (go-core's);
   * `[]` leaves every such message as sent. A rule whose text needs a parameter the server does not send (`min`, `max`, `min_value`,
   * `max_value`, `between`, `in`, `not_in`) reads as the namespace's `out_of_range`.
   */
  readonly prefixes?: readonly string[];
}

const NEEDS_PARAMETERS = new Set(["min", "max", "min_value", "max_value", "between", "in", "not_in"]);

/** `describeFieldError` over a translator: the validator's keys by `prefixes`, then the app's `errors.<reason>` and the library's `core.errors.<reason>`; other text as sent. */
export function fieldMessageWith({ t, te }: { t(key: string): string; te(key: string): boolean }, { prefixes = ["validation_errors"] }: ServerMessagesOptions = {}): (message: string) => string {
  return (message) => {
    const prefix = prefixes.find((candidate) => message.startsWith(`${candidate}.`));
    const reason = prefix === undefined ? message : NEEDS_PARAMETERS.has(message.slice(prefix.length + 1)) ? `${prefix}.out_of_range` : message;
    const key = (prefix === undefined ? [`errors.${reason}`, `core.errors.${reason}`] : [reason, `core.${reason}`]).find((candidate) => te(candidate));
    return key === undefined ? message : t(key);
  };
}

/**
 * What a form needs to speak any go-core refusal, in the app's language (an app's `errors.<reason>` first, then
 * `core.errors.<reason>`): the reason of a field (`identity.email.taken`) becomes a sentence (`describeFieldError`); a refusal of
 * the whole action (a veto of the application's hook, a lock) says its reason instead of the generic line (`failureMessage`); a
 * time a lock ends (`locked_until`) reads as a time of day. Spread into `useForm` / `useCommand`, or call `failureMessage(kind, error)`
 * inside an `failureMessage` of your own to put the application's refusals first; `sentence` is the same for a toast or a line of your own:
 *
 *   const messages = useServerMessages();
 *   useForm({ ...messages, failureMessage: (kind, error) => myRefusal(error) ?? messages.failureMessage(kind, error), defaults, validator });
 */
export function useServerMessages(options: ServerMessagesOptions = {}) {
  const { t, te } = useI18n();
  const format = useFormat();
  const describeError = useDescribeError();

  const keyOf = (reason: string): string | undefined => [`errors.${reason}`, `core.errors.${reason}`].find((candidate) => te(candidate));

  /** The sentence for a failed request; `fallback` for what has no reason of its own. */
  function sentence(error: unknown, fallback?: string): string {
    if (isApiError(error) && error.code) {
      const key = keyOf(error.code);
      const until = typeof error.params?.locked_until === "string" ? new Date(error.params.locked_until) : null;
      if (key && until && !Number.isNaN(until.getTime())) return t(key, { ...error.params, locked_until: format.time(until) });
    }
    return describeError(error, fallback === undefined ? undefined : { fallback });
  }

  return {
    sentence,
    describeFieldError: fieldMessageWith({ t: (key) => t(key), te }, options),
    failureMessage: (kind: FormFailureKind, error: unknown): string | undefined =>
      isApiError(error) && error.code && (kind === "failed" || kind === "forbidden" || kind === "conflict") ? sentence(error) : undefined,
  };
}
