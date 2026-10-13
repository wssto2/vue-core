import { hasInjectionContext, inject } from "vue";
import { useI18n } from "vue-i18n";
import { isApiError } from "../client";
import { useDescribeError, type DescribeError } from "../i18n";
import { accessContextKey } from "./context";
import { useAccessLabels } from "./labels";

/** One thing wrong with a role or a binding, as go-core's `authz.invalid` carries it (`params.problems`): `{code, permission?, detail?}`. */
export interface RoleProblem {
  readonly code: string;
  readonly permission?: string;
  readonly detail?: string;
}

/** The problems of an `authz.invalid` refusal, in the server's order (by code, then permission); empty for any other error. */
export function roleProblems(error: unknown): readonly RoleProblem[] {
  if (!isApiError(error) || error.code !== "authz.invalid") return [];
  const list = error.params?.problems;
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry): RoleProblem[] => {
    if (typeof entry !== "object" || entry === null || typeof (entry as RoleProblem).code !== "string") return [];
    const { code, permission, detail } = entry as Record<string, unknown>;
    return [{ code: code as string, ...(typeof permission === "string" ? { permission } : {}), ...(typeof detail === "string" ? { detail } : {}) }];
  });
}

/**
 * The sentence for a failed request on the access screens: `describeError`, except that a role the server refused as invalid
 * (`authz.invalid`) says every problem, one sentence each. A problem's text is the application's (`accessFeature({ problems: { <code>: "<i18n key>" } })`,
 * for its own codes or to reword a built-in one), then the library's `core.access.problems.<code>`, then a general sentence with the code.
 * `{permission}` in a text is the permission's label (its id outside the access screens), `{detail}` the server's detail.
 * Call it in `setup`.
 */
export function useDescribeRefusal(): DescribeError {
  const { t, te } = useI18n();
  const describeError = useDescribeError();
  const own = hasInjectionContext() ? inject(accessContextKey, null) : null;
  const labels = own ? useAccessLabels() : null;
  return (error, options) => {
    const problems = roleProblems(error);
    if (problems.length === 0) return describeError(error, options);
    const sentences = problems.map((problem) => {
      const key = [own?.problems[problem.code], `core.access.problems.${problem.code}`].find((candidate) => candidate && te(candidate));
      const params = { code: problem.code, permission: problem.permission ? (labels?.permissionLabel(problem.permission) ?? problem.permission) : "", detail: problem.detail ?? "" };
      return t(key ?? "core.access.problems.unknown", params);
    });
    return [...new Set(sentences)].join(" ");
  };
}

/**
 * For a form's `failureMessage`: a refusal of go-core's delegation rules (`authz.escalation`, `self_assignment`, `last_admin`,
 * `role_in_use`, ...) says which rule it was, in the app's language (`core.errors.authz.*`, overridable with `errors.authz.*`),
 * and a role refused as invalid says its problems (see `useDescribeRefusal`); any other failure keeps the form's own sentence for
 * its kind. Call it in `setup`.
 */
export function useRefusalMessage(): (kind: unknown, error: unknown) => string | undefined {
  const describe = useDescribeRefusal();
  return (_kind, error) => (isApiError(error) && error.code?.startsWith("authz.") ? describe(error) : undefined);
}
