import { useI18n } from "vue-i18n";
import { isApiError } from "../client";
import type { FormFailureKind } from "../form";
import { useDescribeError } from "../i18n";

/**
 * What a form of these screens needs to speak go-core's refusals: the reason of a field (`identity.email.taken`) becomes the
 * library's sentence (`core.errors.identity.email.taken`, an app's `errors.…` first), and a refusal of the whole action
 * (a veto of the application's deactivation hook, "not allowed") says its reason instead of the generic line. Spread into
 * `useForm` / `useCommand`:
 *
 *   useCommand({ ...useServerMessages(), run, done })
 */
export function useServerMessages() {
  const { t, te } = useI18n();
  const describeError = useDescribeError();
  return {
    translate: (message: string): string => {
      const key = [`errors.${message}`, `core.errors.${message}`].find((candidate) => te(candidate));
      return key === undefined ? message : t(key);
    },
    failureMessage: (kind: FormFailureKind, error: unknown): string | undefined =>
      isApiError(error) && error.code && (kind === "failed" || kind === "forbidden" || kind === "conflict") ? describeError(error) : undefined,
  };
}
