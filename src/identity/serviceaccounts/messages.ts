import type { FormFailureKind } from "../../form";
import { useRefusalMessage } from "../../access/refusals";
import { useServerMessages } from "../fieldMessages";

/**
 * What the forms of these screens speak: go-core's refusals as `useServerMessages` words them, and a refused delegation
 * (`authz.*`: the actor may not give that role, the account's tenant is elsewhere) in the access screens' own words. Spread
 * into `useCommand` / `useRecordDialog`; `sentence` is the same for a toast. Call it in `setup`.
 */
export function useAccountMessages() {
  const messages = useServerMessages();
  const refusal = useRefusalMessage();
  return { ...messages, failureMessage: (kind: FormFailureKind, error: unknown): string | undefined => refusal(kind, error) ?? messages.failureMessage(kind, error) };
}
