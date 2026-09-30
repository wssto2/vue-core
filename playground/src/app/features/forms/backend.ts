// A fake backend for the forms feature, answering the way go-core does: 422 with field messages, 409 for a stale copy or a workflow
// conflict, a little latency, cancellation. It lives in memory, so a reload resets it.
import { ApiError } from "@wssto2/vue-core/client";

export interface Account {
  id: number;
  name: string;
  tax_id: string;
  email: string;
  phone: string;
  /** Which way the customer wants to be reached; null when not chosen. */
  channel: "email" | "phone" | null;
  street: string;
  city: string;
  country: string | null;
  notes: string;
  status: "active" | "paused" | "archived";
  /** Bumped by every save: a save that carries an older one is stale (409). */
  version: number;
}

export interface AccountBody {
  name: string;
  tax_id: string;
  email: string;
  phone: string;
  channel: "email" | "phone" | null;
  street: string;
  city: string;
  country: string | null;
  notes: string;
  version: number;
}

export interface ContactBody {
  email: string;
  phone: string;
  channel: "email" | "phone" | null;
}

export interface OfferBody {
  customer_id: number;
  delivery_on: string | null;
  channel: "email" | "phone";
  lines: { product: string; quantity: number; unit_price: number }[];
  urgent: boolean;
  extras: string[];
  note: string;
}

const LATENCY_MS = 250;
let counter = 0;

const store = new Map<number, Account>([
  [1, { id: 1, name: "Adria Motors d.o.o.", tax_id: "12345678901", email: "office@adria.example", phone: "+385 21 555 100", channel: "email", street: "Ulica kralja Zvonimira 12", city: "Split", country: "HR", notes: "Prefers invoices on the first of the month.", status: "active", version: 1 }],
  [2, { id: 2, name: "Nova Auto", tax_id: "98765432109", email: "info@nova.example", phone: "", channel: null, street: "", city: "Zagreb", country: "HR", notes: "", status: "active", version: 1 }],
  [3, { id: 3, name: "Blocked Ltd", tax_id: "55555555555", email: "hello@blocked.example", phone: "+387 33 000 000", channel: "phone", street: "Zmaja od Bosne 1", city: "Sarajevo", country: "BA", notes: "On hold.", status: "paused", version: 1 }],
]);

const wait = (signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, LATENCY_MS);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new ApiError({ kind: "aborted", message: "The request was cancelled" }));
    });
  });

const requestId = () => `req-forms-${++counter}`;
const invalid = (fields: Record<string, string[]>) => new ApiError({ kind: "validation", status: 422, message: "Validation failed", fields, requestId: requestId() });
const conflict = (message: string) => new ApiError({ kind: "conflict", status: 409, message, requestId: requestId() });
const copy = (account: Account): Account => ({ ...account });
const find = (id: number): Account => {
  const account = store.get(id);
  if (!account) throw new ApiError({ kind: "notFound", status: 404, message: "No such account", requestId: requestId() });
  return account;
};

/** Field rules the server enforces on top of anything the client checked. */
function check(body: { email: string; tax_id?: string }, id: number) {
  const fields: Record<string, string[]> = {};
  if (body.email.endsWith("@taken.example")) fields.email = ["This e-mail address is used by another account."];
  if (body.tax_id !== undefined && body.tax_id !== "" && !/^\d{11}$/.test(body.tax_id)) fields.tax_id = ["The tax id has 11 digits."];
  if (Object.keys(fields).length > 0) throw invalid(fields);
  void id;
}

export const backend = {
  accounts: async (signal?: AbortSignal): Promise<Account[]> => {
    await wait(signal);
    return [...store.values()].map(copy);
  },

  account: async (id: number, signal?: AbortSignal): Promise<Account> => {
    await wait(signal);
    return copy(find(id));
  },

  /** The record's full update: every field of the record, and the version it was read at. */
  updateAccount: async (id: number, body: AccountBody): Promise<Account> => {
    await wait();
    const account = find(id);
    if (body.version !== account.version) throw conflict("The account was changed by someone else.");
    if (account.status === "archived") throw conflict("An archived account cannot be edited.");
    check(body, id);
    Object.assign(account, { ...body, version: account.version + 1 });
    return copy(account);
  },

  /** A dedicated endpoint for the contact group: only those fields, no version, nothing returned. */
  updateContact: async (id: number, body: ContactBody): Promise<void> => {
    await wait();
    const account = find(id);
    check(body, id);
    Object.assign(account, { ...body, version: account.version + 1 });
  },

  /** A command: advance the status. Asking for the status the account already has is a workflow conflict, not a stale copy. */
  changeStatus: async (id: number, body: { status: Account["status"]; note: string }): Promise<Account> => {
    await wait();
    const account = find(id);
    if (account.status === body.status) throw conflict(`The account is already ${body.status}.`);
    if (body.status === "archived" && body.note.trim() === "") throw invalid({ note: ["Say why the account is archived."] });
    Object.assign(account, { status: body.status, version: account.version + 1 });
    return copy(account);
  },

  /** What a colleague's save does to the record: the next save of the copy on screen is stale. */
  touch: async (id: number): Promise<void> => {
    const account = find(id);
    account.notes = `${account.notes} (edited by a colleague)`.trim();
    account.phone = account.phone || "+385 1 600 000";
    account.version += 1;
  },

  customers: async (query: string, signal?: AbortSignal): Promise<{ id: number; name: string; city: string }[]> => {
    await wait(signal);
    const needle = query.trim().toLowerCase();
    return [...store.values()].filter((account) => account.name.toLowerCase().includes(needle)).map((account) => ({ id: account.id, name: account.name, city: account.city }));
  },

  createOffer: async (body: OfferBody): Promise<{ id: number }> => {
    await wait();
    if (body.customer_id === 3) throw invalid({ customer_id: ["This customer is on hold: offers cannot be made for it."] });
    const fields: Record<string, string[]> = {};
    body.lines.forEach((line, index) => {
      if (line.quantity > 100) fields[`lines.${index}.quantity`] = ["Only 100 are in stock."];
    });
    if (body.extras.includes("insurance") && body.urgent) fields.extras = ["Insurance cannot be added to an urgent offer."];
    if (Object.keys(fields).length > 0) throw invalid(fields);
    return { id: 1000 + ++counter };
  },
};
