import { backend } from "./backend";

export type { Account, AccountBody, ContactBody, OfferBody } from "./backend";

/** The forms feature's endpoints. A real feature builds requests over the platform's client here; views never do. */
export const api = backend;
