import { useResourceForm, type RecordSource } from "@wssto2/vue-core/form";
import type { Account, AccountBody } from "./api";
import { api } from "./api";
import { camel, email, required, validator } from "./validate";

/** What the account's fields edit: the draft. Not the DTO: a nullable column is `""` here, a missing country `null`. */
export interface AccountValues {
  name: string;
  taxId: string;
  email: string;
  phone: string;
  mobile: string;
  channel: "email" | "phone" | null;
  street: string;
  city: string;
  country: string | null;
  notes: string;
}

export const emptyAccount = (): AccountValues => ({ name: "", taxId: "", email: "", phone: "", mobile: "", channel: null, street: "", city: "", country: null, notes: "" });

/** DTO to draft. */
export const accountValues = (account: Account): AccountValues => ({
  name: account.name,
  taxId: account.tax_id,
  email: account.email,
  phone: account.phone,
  mobile: account.mobile,
  channel: account.channel,
  street: account.street,
  city: account.city,
  country: account.country,
  notes: account.notes,
});

/** Draft to the record's full-update body: every field, plus the version the record was read at. */
export const accountBody = (values: AccountValues, account: Account): AccountBody => ({
  name: values.name.trim(),
  tax_id: values.taxId,
  email: values.email.trim(),
  phone: values.phone,
  mobile: values.mobile,
  channel: values.channel,
  street: values.street,
  city: values.city,
  country: values.country,
  notes: values.notes,
  version: account.version,
});

/** The schema (its messages are this app's words; `t` would supply them in a real one). */
export const accountValidator = (words: { required: string; email: string }) =>
  validator<AccountValues>({ name: required(words.required), email: email(words.email), city: required(words.required) });

/** Which fields each group of the record holds: the sheet edits, restores and saves exactly these. */
export const GROUPS = {
  identity: ["name", "taxId"],
  contact: ["email", "mobile", "phone", "channel"],
  address: ["street", "city", "country"],
  notes: ["notes"],
} as const satisfies Record<string, readonly (keyof AccountValues)[]>;

export type AccountGroup = keyof typeof GROUPS;

/** The account's form: hydrated from the route's record (no request of its own), saved with the record's full update. */
export function useAccountForm(source: RecordSource<Account>, words: { required: string; email: string }) {
  return useResourceForm({
    source,
    defaults: emptyAccount,
    validator: accountValidator(words),
    toValues: accountValues,
    // The server names fields in snake_case: its messages land on the camelCase draft fields.
    serverField: camel,
    save: (values, account, { idempotencyKey }) => {
      void idempotencyKey; // a real client sends it as the `Idempotency-Key` header
      return api.updateAccount(account.id, accountBody(values, account));
    },
  });
}

export type AccountForm = ReturnType<typeof useAccountForm>;
