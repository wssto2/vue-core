import { AGENTS, CUSTOMERS, LEADS, type Customer, type Lead } from "./data";

/**
 * Answers the list endpoints of the fake backend the way go-core's datatable does: the same query
 * parameters, the same `{ success, data, meta }` envelope, a little latency, and cancellation: a
 * request whose signal aborts fails with an AbortError, like `fetch`.
 */
const LATENCY_MS = 200;
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 30, 12, 0, 0);

const wait = (ms: number, signal: AbortSignal | null | undefined) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "X-Request-ID": "playground" } });

function compare(a: unknown, b: unknown): number {
  return String(a ?? "").localeCompare(String(b ?? ""), "en", { numeric: true });
}

function paginate<T>(rows: readonly T[], params: URLSearchParams, extra: Record<string, unknown> = {}) {
  const perPage = Number(params.get("per_page") ?? 25);
  const lastPage = Math.max(1, Math.ceil(rows.length / perPage));
  const page = Math.min(Number(params.get("page") ?? 1), lastPage);
  const from = (page - 1) * perPage;
  const slice = rows.slice(from, from + perPage);
  return json(200, {
    success: true,
    data: slice,
    meta: { total: rows.length, page, per_page: perPage, last_page: rows.length === 0 ? 0 : lastPage, from: slice.length ? from + 1 : 0, to: from + slice.length, authors: AGENTS, ...extra },
  });
}

function sorted<T>(rows: readonly T[], params: URLSearchParams, read: (row: T, key: string) => unknown): T[] {
  const key = params.get("order_col");
  if (!key) return [...rows];
  const direction = params.get("order_dir") === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => direction * compare(read(a, key), read(b, key)));
}

function withinPreset(iso: string, preset: string): boolean {
  const age = (NOW - Date.parse(iso)) / DAY;
  return { today: age < 1, yesterday: age >= 1 && age < 2, this_week: age < 7, last_week: age >= 7 && age < 14, this_month: age < 30, last_month: age >= 30 && age < 60, this_year: age < 365, last_year: age >= 365 }[preset] ?? true;
}

function customers(params: URLSearchParams) {
  const search = (params.get("search") ?? "").toLowerCase();
  const city = params.get("city");
  const rows = CUSTOMERS.filter((c: Customer) => (!search || `${c.first_name} ${c.last_name} ${c.company_name} ${c.email ?? ""} ${c.city ?? ""}`.toLowerCase().includes(search)) && (!city || c.city === city));
  return paginate(sorted(rows, params, (row, key) => (row as unknown as Record<string, unknown>)[key]), params);
}

function leads(params: URLSearchParams) {
  const search = (params.get("search") ?? "").toLowerCase();
  const phase = params.get("phase");
  const assigned = params.get("assigned_to");
  const followup = params.get("followup");
  const created = params.get("created_at");
  const view = params.get("view") ?? "all";
  const matches = (lead: Lead, ignoreView = false) =>
    (!search || `${lead.first_name} ${lead.last_name} ${lead.email ?? ""}`.toLowerCase().includes(search)) &&
    (!phase || (phase === "open" ? lead.phase.phase < 7 : phase === "7_bought" ? lead.phase.decision === "bought" : phase === "7_rejected" ? lead.phase.decision === "rejected" : String(lead.phase.phase) === phase)) &&
    (!assigned || (assigned === "none" ? lead.phase.assigned_to === null : String(lead.phase.assigned_to) === assigned)) &&
    (!followup || (followup === "none" ? lead.next_contact_at === null : lead.next_contact_at !== null && (followup === "overdue" ? Date.parse(lead.next_contact_at) < NOW : Date.parse(lead.next_contact_at) >= NOW))) &&
    (!created || withinPreset(lead.created_at, created)) &&
    (ignoreView || view === "all" || (view === "mine" && lead.phase.assigned_to === 1));
  const rows = LEADS.filter((lead) => matches(lead));
  const counts = [{ key: "all", count: LEADS.filter((lead) => matches(lead, true)).length }, { key: "mine", count: LEADS.filter((lead) => matches(lead, true) && lead.phase.assigned_to === 1).length }];
  return paginate(
    sorted(rows, params, (row, key) => (key === "first_name" ? `${row.first_name} ${row.last_name}` : (row as unknown as Record<string, unknown>)[key])),
    params,
    { views: counts },
  );
}

/** The response for a call to the fake list endpoints, or null when `url` is not one of them. */
export async function serveLists(url: string, init: RequestInit): Promise<Response | null> {
  const parsed = new URL(url, "http://playground.local");
  const path = parsed.pathname.replace(/^\/api\/v1/, "");
  const record = /^\/crm\/(customers|leads)\/(\d+)$/.exec(path);
  if (record) {
    await wait(LATENCY_MS / 2, init.signal);
    const found = (record[1] === "customers" ? CUSTOMERS : LEADS).find((row) => row.id === Number(record[2]));
    return found ? json(200, { success: true, data: found }) : json(404, { success: false, error: "not found" });
  }
  if (path !== "/crm/customers" && path !== "/crm/leads") return null;
  await wait(LATENCY_MS, init.signal);
  return path === "/crm/customers" ? customers(parsed.searchParams) : leads(parsed.searchParams);
}
