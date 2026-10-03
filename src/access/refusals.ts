import { isApiError } from "../client";
import { useDescribeError } from "../i18n";

/**
 * For a form's `failureMessage`: a refusal of go-core's delegation rules (`authz.escalation`, `self_assignment`, `last_admin`,
 * `role_in_use`, ...) says which rule it was, in the app's language (`core.errors.authz.*`, overridable with `errors.authz.*`);
 * any other failure keeps the form's own sentence for its kind. Call it in `setup`.
 */
export function useRefusalMessage(): (kind: unknown, error: unknown) => string | undefined {
  const describeError = useDescribeError();
  return (_kind, error) => (isApiError(error) && error.code?.startsWith("authz.") ? describeError(error) : undefined);
}
