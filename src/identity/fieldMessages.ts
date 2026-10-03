import { useI18n } from "vue-i18n";
import { isApiError } from "../client";
import { useFormat } from "../format";
import type { FormFailureKind } from "../form";
import { useDescribeError } from "../i18n";

/**
 * What a form of these screens needs to speak go-core's refusals, in the app's language (an app's `errors.<reason>` first, then
 * `core.errors.<reason>`): the reason of a field (`identity.email.taken`) becomes a sentence; a refusal of the whole action (a
 * veto of the application's deactivation hook, a lock) says its reason instead of the generic line; a time a lock ends (`locked_until`)
 * reads as a time of day. Spread into `useForm` / `useCommand`; `sentence` is the same for a toast or a line of your own:
 *
 *   const messages = useServerMessages();
 *   useCommand({ ...messages, run, done });
 */
export function useServerMessages() {
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
    translate: (message: string): string => {
      const key = keyOf(message);
      return key === undefined ? message : t(key);
    },
    failureMessage: (kind: FormFailureKind, error: unknown): string | undefined =>
      isApiError(error) && error.code && (kind === "failed" || kind === "forbidden" || kind === "conflict") ? sentence(error) : undefined,
  };
}
