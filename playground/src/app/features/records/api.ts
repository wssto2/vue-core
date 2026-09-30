// A fake backend for the record pages: in-memory data, a little latency, a missing record (id 999 is a
// 404) and switches to make one region fail. Nothing here is the library's: it stands where an app's API module would.
import { ApiError } from "@wssto2/vue-core/client";

export interface Dealer {
  readonly id: number;
  readonly name: string;
  readonly code: string;
  readonly city: string;
  readonly active: boolean;
}
export interface Location {
  readonly id: number;
  readonly name: string;
}
export interface Customer {
  readonly id: number;
  readonly name: string;
  readonly city: string;
  readonly phone: string;
  readonly email: string;
}
export interface Lead {
  readonly id: number;
  readonly name: string;
  readonly company: string;
  readonly phone: string;
  readonly email: string;
  readonly message: string;
  readonly phase: 1 | 2 | 3;
}
export interface Comment {
  readonly id: number;
  readonly author: string;
  readonly text: string;
}
export interface PhaseEvent {
  readonly id: number;
  readonly phase: 1 | 2 | 3;
  readonly at: string;
}

export const dealerIds = [1, 2, 3] as const;
export const customerIds = [11, 12, 13, 14] as const;
export const leadIds = [21, 22] as const;

const dealers = new Map<number, Dealer>([
  [1, { id: 1, name: "Auto Split", code: "BIR 101", city: "Split", active: true }],
  [2, { id: 2, name: "Adria Motors", code: "BIR 102", city: "Zagreb", active: true }],
  [3, { id: 3, name: "Kvarner Cars", code: "BIR 103", city: "Rijeka", active: false }],
]);
const customers = new Map<number, Customer>(
  customerIds.map((id, position) => [id, { id, name: ["Ana Horvat", "Marko Kovač", "Iva Babić", "Petar Jurić"][position]!, city: ["Zagreb", "Split", "Osijek", "Zadar"][position]!, phone: `+385 91 000 00${position}`, email: `customer${id}@example.com` }]),
);
const leads = new Map<number, Lead>([
  [21, { id: 21, name: "Luka Matić", company: "Matić d.o.o.", phone: "+385 98 123 456", email: "luka@example.com", message: "Interested in a test drive next week.", phase: 2 }],
  [22, { id: 22, name: "Maja Novak", company: "", phone: "+385 99 765 432", email: "maja@example.com", message: "Asked about financing.", phase: 1 }],
]);
const comments = new Map<number, Comment[]>([[21, [{ id: 1, author: "Ana", text: "Called, will call back Thursday." }, { id: 2, author: "Ivan", text: "Offer sent." }]]]);

/** What the demo can be told to break: each region fails on its own. */
export const outage = { history: false, comments: false };
export const latency = { ms: 350 };

function wait(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, latency.ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new ApiError({ kind: "aborted", message: "aborted" }));
    });
  });
}

function found<T>(map: Map<number, T>, id: number): T {
  const record = map.get(id);
  if (!record) throw new ApiError({ kind: "notFound", message: "not found", status: 404 });
  return record;
}

export interface Read {
  readonly signal?: AbortSignal;
}

export const api = {
  dealers: {
    async get(id: number, { signal }: Read = {}): Promise<Dealer> {
      await wait(signal);
      return found(dealers, id);
    },
    async locations(id: number, { signal }: Read = {}): Promise<readonly Location[]> {
      await wait(signal);
      found(dealers, id);
      return [{ id: id * 10 + 1, name: `${found(dealers, id).name} centre` }, { id: id * 10 + 2, name: `${found(dealers, id).name} service` }];
    },
    /** A slow save: the user can leave the record while it runs. */
    async rename(id: number, name: string): Promise<Dealer> {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const saved = { ...found(dealers, id), name };
      dealers.set(id, saved);
      return saved;
    },
  },
  customers: {
    async get(id: number, { signal }: Read = {}): Promise<Customer> {
      await wait(signal);
      return found(customers, id);
    },
  },
  leads: {
    async get(id: number, { signal }: Read = {}): Promise<Lead> {
      await wait(signal);
      return found(leads, id);
    },
    async comments(id: number, { signal }: Read = {}): Promise<readonly Comment[]> {
      await wait(signal);
      if (outage.comments) throw new ApiError({ kind: "server", message: "comments down", status: 500 });
      return comments.get(id) ?? [];
    },
    async addComment(id: number, text: string): Promise<void> {
      comments.set(id, [...(comments.get(id) ?? []), { id: Date.now(), author: "You", text }]);
    },
    async history(id: number, { signal }: Read = {}): Promise<readonly PhaseEvent[]> {
      await wait(signal);
      if (outage.history) throw new ApiError({ kind: "network", message: "offline" });
      const phase = found(leads, id).phase;
      return ([1, 2, 3] as const).filter((each) => each <= phase).map((each) => ({ id: each, phase: each, at: `2026-09-${10 + each}` }));
    },
  },
};
