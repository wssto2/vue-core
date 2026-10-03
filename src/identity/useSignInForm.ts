import { computed, type ComputedRef } from "vue";
import { useI18n } from "vue-i18n";
import { isApiError } from "../client";
import { useForm, type Form, type FormValidator } from "../form";
import { useFormat } from "../format";
import { useDescribeError } from "../i18n";
import { usePlatform } from "../platform";
import { lockedUntil, signIn } from "./signIn";

interface SignInValues {
  login: string;
  password: string;
}

/**
 * The state of a sign-in form, for the sign-in page and the prompt of an expired session: both fields required
 * before the server is asked, and every refusal (wrong login or password, the lock with the time it ends, an
 * inactive account, too many attempts) as one sentence for `passwordError`, in the app's language.
 * `submit()` resolves true once the person is signed in.
 */
export function useSignInForm(options: { login?: string } = {}): { form: Form<SignInValues>; passwordError: ComputedRef<string | undefined>; submit: () => Promise<boolean> } {
  const { t } = useI18n();
  const platform = usePlatform();
  const format = useFormat();
  const describeError = useDescribeError();

  const required: FormValidator<SignInValues> = {
    safeParse(input) {
      const values = input as SignInValues;
      const issues = (["login", "password"] as const).filter((key) => values[key] === "").map((key) => ({ path: [key], message: t("core.identity.signin.required") }));
      return issues.length === 0 ? { success: true, data: values } : { success: false, error: { issues } };
    },
  };

  const form = useForm({
    defaults: (): SignInValues => ({ login: options.login ?? "", password: "" }),
    validator: required,
    failureMessage(_kind, error) {
      const until = lockedUntil(error);
      if (until) return t("core.errors.identity.signin.locked", { locked_until: format.time(until) });
      return isApiError(error) ? describeError(error) : undefined;
    },
  });

  // A refusal belongs under the password; a validator refusal already put its messages on the fields.
  const passwordError = computed(() => form.errors.first("password") ?? (form.failure.value?.error ? form.failure.value.message : undefined));

  return { form, passwordError, submit: async () => (await form.submit((payload) => signIn(platform, payload))).status === "saved" };
}
