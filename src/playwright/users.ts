import type { Page } from "@playwright/test";
import type { ActivityRow, ChangeRow, SessionItem, SignInRow, UserDetail } from "../modules/identity/entities";
import type { ApiKey, ServiceAccount } from "../modules/serviceaccount/entities";
import { datatable, json, noContent, ok, type Answer } from "./envelope";
import { readRequest, type Call } from "./request";

/**
 * The people of the identity module as it serves them under `/api/v1/iam/users` (list with its views, one person's record, sessions,
 * sign-ins, changes, activity, unlock, activate) and the service accounts of `/api/v1/iam/service-accounts` (list, record, keys).
 * Every write is reported with its body. Only these paths are answered: the rest of the application's API, the access routes
 * (`serveAccess`) and what your application adds to a person (`ext`) are yours. The rules themselves are the server's tests'.
 */

export type Write = Call;

export const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

/** A person as go-core's list row and record carry them (`UserRow` / `UserDetail`; the same shape). */
export const person = (id: number, name: string, overrides: Partial<UserDetail> = {}): UserDetail => ({
  id, login: name.split(" ")[0]!.toLowerCase(), name, email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.test`, phone: "", locale: "en",
  active: true, status: "active", last_sign_in: null, locked_until: null, created_at: "2025-02-03T10:12:00Z", ...overrides,
});

/** A live session of a person (`SessionItem`). */
export const session = (id: number, device: string, overrides: Partial<SessionItem> = {}): SessionItem => ({
  id, device, ip: "10.20.4.12", last_used_at: ago(2), expires_at: new Date(Date.now() + 6 * 3_600_000).toISOString(), created_at: ago(300), opened_by: null, current: false, ...overrides,
});

/** A row of the sign-in history (`SignInRow`). */
export const signin = (id: number, event: SignInRow["event"], overrides: Partial<SignInRow> = {}): SignInRow => ({
  id, event, ip: "93.142.8.201", device: "Chrome · Windows", actor: null, created_at: ago(id * 20), ...overrides,
});

/** A change to the person (`ChangeRow`). */
export const change = (id: number, action: ChangeRow["action"], overrides: Partial<ChangeRow> = {}): ChangeRow => ({
  id, action, fields: [], before: {}, after: {}, actor: { id: 4, name: "Test Manager" }, created_at: ago(id * 90), ...overrides,
});

/** What a person did (`ActivityRow`). */
export const activity = (id: number, recordType: string, recordId: number, action: ActivityRow["action"], overrides: Partial<ActivityRow> = {}): ActivityRow => ({
  id, area: "general", record_type: recordType, record_id: recordId, action, signed_in_as: null, created_at: ago(id * 40), ...overrides,
});

export const serviceAccount = (id: number, name: string, overrides: Partial<ServiceAccount> = {}): ServiceAccount => ({
  id, name, description: "", tenant: null, owner: { id: 1, name: "Test Admin" }, created_by: { id: 1, name: "Test Admin" },
  created_at: "2026-09-12T10:00:00Z", active_keys: 1, last_used_at: ago(3), deactivated_at: null, ...overrides,
});

export type UsersState = {
  people: UserDetail[];
  sessions: SessionItem[];
  signins: SignInRow[];
  changes: ChangeRow[];
  activity: ActivityRow[];
  serviceAccounts: ServiceAccount[];
  /** The keys of each service account, by its id. */
  keys: Record<number, ApiKey[]>;
  /** Whether the person's record answers `404` on manage actions (seen but not managed). */
  notManageable: boolean;
};

export const freshState = (overrides: Partial<UsersState> = {}): UsersState => ({
  people: [], sessions: [], signins: [], changes: [], activity: [], serviceAccounts: [], keys: {}, notManageable: false, ...overrides,
});

export type UsersRequest = { method: string; path: string; url: URL; body: unknown };

export type UsersOptions = {
  state?: UsersState;
  /** Where the writes are reported (default a new array, returned). */
  writes?: Write[];
  /** Whether a person is in the list for these query parameters, besides the view and the search (your `ext` filters). */
  filter?: (person: UserDetail, params: URLSearchParams) => boolean;
  /** Answers first: an answer is served (and a write reported), undefined leaves the request to the routes below. */
  hook?: (request: UsersRequest, state: UsersState) => Answer | undefined;
};

const notFound = (code?: string) => json({ success: false, error: "not found", message: "not found", ...(code ? { code } : {}) }, 404);

/** Serves the users module; every write (with its JSON body) is reported, and the state can be changed by a spec. */
export async function serveUsers(page: Page, options: UsersOptions = {}) {
  const writes = options.writes ?? [];
  const state = options.state ?? freshState();

  const answer = ({ method, path, url, body }: UsersRequest): Answer | undefined => {
    if (path === "/iam/users" && method === "GET") {
      const view = url.searchParams.get("view") ?? "active";
      const search = (url.searchParams.get("search") ?? "").toLowerCase();
      const matching = state.people.filter((p) => (!search || p.name.toLowerCase().includes(search)) && (options.filter?.(p, url.searchParams) ?? true));
      const count = (key: string) => matching.filter((p) => key === "all" || p.status === key).length;
      return json(datatable(matching.filter((p) => view === "all" || p.status === view), ["active", "locked", "inactive", "all"].map((key) => ({ key, count: count(key) }))));
    }
    if (path === "/iam/users" && method === "POST") {
      const input = body as Partial<UserDetail> & { name: string };
      const created = person(Math.max(0, ...state.people.map((p) => p.id)) + 1, input.name, input);
      state.people.push(created);
      return json(ok(created));
    }

    const one = /^\/iam\/users\/(\d+)(?:\/(.*))?$/.exec(path);
    if (one) {
      const id = Number(one[1]);
      const rest = one[2] ?? "";
      const found = state.people.find((p) => p.id === id);
      if (method !== "GET" && state.notManageable) return notFound("identity.account.not_found");
      const record = found ?? person(id, "Unknown Person");

      if (rest === "") {
        if (method === "PUT") {
          const input = body as Partial<UserDetail>;
          const ext = input.ext === undefined ? record.ext : { ...(record.ext as object), ...(input.ext as object) };
          return json(ok({ ...record, ...input, ...(ext === undefined ? {} : { ext }) }));
        }
        if (method === "DELETE") return noContent();
        return json(ok(record));
      }
      if (rest === "sessions" && method === "GET") return json(ok({ sessions: state.sessions }));
      if (rest === "sessions" && method === "DELETE") { state.sessions = []; return noContent(); }
      const revoke = /^sessions\/(\d+)$/.exec(rest);
      if (revoke && method === "DELETE") { state.sessions = state.sessions.filter((s) => s.id !== Number(revoke[1])); return noContent(); }
      if (rest === "signins") {
        const failed = url.searchParams.get("view") === "failed";
        const rows = failed ? state.signins.filter((s) => ["wrong_password", "locked_out", "refused_inactive"].includes(s.event)) : state.signins;
        return json(datatable(rows, [{ key: "all", count: state.signins.length }, { key: "failed", count: state.signins.filter((s) => ["wrong_password", "locked_out", "refused_inactive"].includes(s.event)).length }]));
      }
      // The views of changes (access, details) and the areas of activity are your application's: answer them from `hook`.
      if (rest === "changes") return json(datatable(state.changes, [{ key: "all", count: state.changes.length }]));
      if (rest === "activity") {
        const area = url.searchParams.get("area");
        return json(datatable(area ? state.activity.filter((a) => a.area === area) : state.activity, [{ key: "all", count: state.activity.length }]));
      }
      if (rest === "deactivate" || rest === "activate") return json(ok({}));
      if (rest === "password") return noContent();
      if (rest === "unlock") { record.locked_until = null; record.status = "active"; return json(ok({ unlocked: true })); }
      return undefined;
    }

    if (path === "/iam/service-accounts") return json(ok({ service_accounts: state.serviceAccounts }));
    const account = /^\/iam\/service-accounts\/(\d+)(?:\/(keys))?$/.exec(path);
    if (account && method === "GET") {
      const found = state.serviceAccounts.find((a) => a.id === Number(account[1]));
      if (!found) return notFound();
      return json(ok(account[2] ? { keys: state.keys[found.id] ?? [] } : found));
    }
    return undefined;
  };

  await page.route(/\/api\/v1\/iam\/(users|service-accounts)(\/|\?|$)/, (route) => {
    const { method, url, path, body } = readRequest(route);
    const request = { method, path, url, body };
    const reply = options.hook?.(request, state) ?? answer(request);
    if (!reply) return route.fallback();
    if (method !== "GET") writes.push({ method, path, body: body ?? null });
    return route.fulfill(reply);
  });

  return { writes, state };
}
