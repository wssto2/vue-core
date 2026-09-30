// The playground's fake backend: customers and leads, generated deterministically, served in go-core's list envelope.
export interface Customer {
  readonly id: number;
  readonly type: 1 | 2;
  readonly first_name: string;
  readonly last_name: string;
  readonly company_name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly city: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly created_by: number;
}

export interface Lead {
  readonly id: number;
  readonly first_name: string;
  readonly last_name: string;
  readonly email: string | null;
  readonly mobile_phone: string | null;
  readonly city: string | null;
  readonly created_at: string;
  readonly created_by: number;
  readonly heard_from: number;
  readonly next_contact_at: string | null;
  readonly phase: { readonly phase: number; readonly decision: "bought" | "rejected" | null; readonly assigned_to: number | null; readonly agent: { readonly name: string } | null };
}

export const AGENTS = [
  { id: 1, name: "Ana Horvat" },
  { id: 2, name: "Marko Babić" },
  { id: 3, name: "Iva Knežević" },
] as const;

const FIRST = ["Ana", "Marko", "Iva", "Luka", "Petra", "Ivan", "Maja", "Tomislav", "Nina", "Josip", "Sara", "Filip"];
const LAST = ["Horvat", "Kovač", "Babić", "Marić", "Jurić", "Novak", "Knežević", "Vuković", "Pavlović", "Bošnjak"];
const COMPANIES = ["Auto Split d.o.o.", "Dalmacija Promet", "Zagreb Logistika", "Jadran Trans", "Slavonija Motors"];
const CITIES = ["Split", "Zagreb", "Rijeka", "Osijek", "Zadar", null];

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 30, 12, 0, 0);
const pick = <T,>(items: readonly T[], seed: number): T => items[seed % items.length] as T;

export const CUSTOMERS: readonly Customer[] = Array.from({ length: 57 }, (_, index): Customer => {
  const id = index + 1;
  const company = id % 5 === 0;
  const first = pick(FIRST, id * 3);
  const last = pick(LAST, id * 7);
  return {
    id,
    type: company ? 2 : 1,
    first_name: company ? "" : first,
    last_name: company ? "" : last,
    company_name: company ? pick(COMPANIES, id) : "",
    email: id % 4 === 0 ? null : `${(company ? "info" : first).toLowerCase()}.${id}@example.com`,
    phone: id % 3 === 0 ? `+385 91 555 ${String(1000 + id)}` : null,
    city: pick(CITIES, id * 5),
    created_at: new Date(NOW - id * 2 * DAY).toISOString(),
    updated_at: new Date(NOW - id * DAY).toISOString(),
    created_by: pick(AGENTS, id).id,
  };
});

export const LEADS: readonly Lead[] = Array.from({ length: 83 }, (_, index): Lead => {
  const id = index + 1;
  const phase = (id % 7) + 1;
  const agent = id % 6 === 0 ? null : pick(AGENTS, id);
  return {
    id,
    first_name: pick(FIRST, id * 5),
    last_name: pick(LAST, id * 3),
    email: id % 5 === 0 ? null : `lead${id}@example.com`,
    mobile_phone: id % 2 === 0 ? `+385 98 777 ${String(2000 + id)}` : null,
    city: pick(CITIES, id * 2),
    created_at: new Date(NOW - id * DAY * 0.6).toISOString(),
    created_by: pick(AGENTS, id + 1).id,
    heard_from: (id % 10) + 1,
    // a third overdue, a third today or later, a third none
    next_contact_at: phase === 7 || id % 3 === 0 ? null : new Date(NOW + (id % 3 === 1 ? -2 : 3) * DAY).toISOString(),
    phase: { phase, decision: phase === 7 ? (id % 2 ? "bought" : "rejected") : null, assigned_to: agent?.id ?? null, agent: agent ? { name: agent.name } : null },
  };
});
