import { hasInjectionContext, inject, type InjectionKey } from "vue";
import { useI18n } from "vue-i18n";
import { isApiError } from "../client";

export interface DescribeErrorOptions {
  /**
   * What to say when nothing more specific is known: a server fault, an unreadable answer, an error that
   * is not a failed request, a rejection without a reason of its own. Say what failed ("The changes could not be saved.").
   */
  readonly fallback?: string;
}

/** The sentence to show a person for a failure; see `useDescribeError`. */
export type DescribeError = (error: unknown, options?: DescribeErrorOptions) => string;

/** The part of a vue-i18n composer the sentences are read with. */
interface Translator {
  t(key: string, params?: Record<string, unknown>): string;
  te(key: string): boolean;
}

/**
 * The application's own sentence for an error, ahead of the library's (`createApplication({ describeError })`):
 * for error types the library does not know (an app's older HTTP client). `undefined` leaves the error to the library.
 */
export type AppErrorDescriber = (error: unknown) => string | undefined;

export const appErrorDescriberKey: InjectionKey<AppErrorDescriber> = Symbol("vue-core.describeError");

/** The application's describer, when one was installed and this runs in a setup. */
export function useAppErrorDescriber(): AppErrorDescriber | null {
  return hasInjectionContext() ? inject(appErrorDescriberKey, null) : null;
}

/** `describeError` over a translator; exported for the composable and tests. */
export function describeErrorWith({ t, te }: Translator): DescribeError {
  return (error, { fallback } = {}) => {
    const unexpected = fallback ?? t("core.errors.unexpected");
    if (!isApiError(error)) return unexpected;

    // A reason the client can translate does not depend on the server's translator: the app's
    // `errors.<code>` first, then the library's own `core.errors.<code>`.
    if (error.code) {
      for (const key of [`errors.${error.code}`, `core.errors.${error.code}`]) {
        if (te(key)) return t(key, { ...error.params });
      }
      // The server translated the sentence it sent with a reason; without one it is written for logs.
      if (error.message) return error.message;
    }

    switch (error.kind) {
      case "unauthorized":
        return t("core.errors.unauthenticated");
      case "forbidden":
        return t("core.errors.forbidden");
      case "notFound":
        return t("core.errors.not_found");
      case "conflict":
        return t("core.errors.conflict");
      case "network":
        return t("core.errors.offline");
      case "aborted":
        return t("core.errors.cancelled");
      case "server":
      case "malformed":
        return unexpected;
      case "validation":
        if (Object.keys(error.fields).length > 0) return t("core.errors.check_fields");
        break;
    }
    if (error.status === 429) return t("core.errors.rate_limited");
    // Any other 4xx: the server's text is the only description of a rule the client cannot know.
    return fallback ?? (error.message || t("core.errors.unexpected"));
  };
}

/**
 * The sentence for a failed request, in the app's language, for toasts and inline messages.
 * Call it in `setup` (it reads the composer), use the result anywhere later:
 *
 *   const describeError = useDescribeError();
 *   try { await save(); } catch (error) { toast.error(describeError(error, { fallback: t("tickets.save_failed") })); }
 *
 * In order: a go-core `code` the app or the library has a text for (`errors.<code>`, then
 * `core.errors.<code>`, with the error's `params`); the server's own text when it sent a code (it is
 * already translated); then by kind: 401, 403, 404, 409, no answer, cancelled, 429, "check the marked
 * fields" for a validation answer with fields; server faults and anything unreadable give `fallback`;
 * any other 4xx gives `fallback` too, or the server's text. The application's own describer
 * (`createApplication({ describeError })`) is asked first.
 */
export function useDescribeError(): DescribeError {
  const { t, te } = useI18n();
  const own = useAppErrorDescriber();
  const library = describeErrorWith({ t: (key, params) => t(key, params ?? {}), te: (key) => te(key) });
  return own ? (error, options) => own(error) ?? library(error, options) : library;
}
