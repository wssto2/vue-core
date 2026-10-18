import type { Page } from "@playwright/test";
import type { PendingEmail, ProfileResponse, SessionItem, SessionList, SignInRow } from "../modules/identity/entities";
import { datatable, json, noContent, ok, type Answer } from "./envelope";
import { readRequest, type Call } from "./request";

/**
 * "My profile" as the identity module serves it (`/api/v1/iam/profile…`, go-core `ProfileResponse`): the record, the e-mail change
 * with its confirmation, the password, the person's own sessions and sign-ins. Every write is reported with its body; an endpoint
 * answers as `answers` says (success when absent). Routes your application adds under `iam/profile` are yours: register them
 * after this, they run first, and this answers the rest.
 */

export type ProfileCall = Call;

const FUTURE = "2099-01-01T09:30:00.000Z";
const PAST = "2020-01-01T00:00:00.000Z";
/** The address a confirmed e-mail change ends with (default; `newEmail` changes it). */
export const NEW_EMAIL = "new@example.test";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const profile = (overrides: Partial<ProfileResponse> = {}): ProfileResponse => ({
  id: 1, login: "admin", name: "Test Admin", email: "admin@test.com", phone: "", locale: "en", created_at: "2025-02-03T10:12:00Z", pending_email: null, ...overrides,
});
export const pendingChange = (overrides: Partial<PendingEmail> = {}): PendingEmail => ({ email: NEW_EMAIL, expires_at: FUTURE, resend_available_at: PAST, attempts_left: 3, ...overrides });

export const ownSession = (id: number, device: string, overrides: Partial<SessionItem> = {}): SessionItem => ({
  id, device, ip: "10.20.4.12", opened_by: null, current: false, last_used_at: minutesAgo(2), expires_at: new Date(Date.now() + 6 * 3_600_000).toISOString(), created_at: minutesAgo(300), ...overrides,
});
export const ownSignin = (id: number, event: SignInRow["event"], overrides: Partial<SignInRow> = {}): SignInRow => ({
  id, event, ip: "93.142.8.201", device: "Chrome · Windows", actor: null, created_at: minutesAgo(id * 20), ...overrides,
});

export type ProfileAnswers = Partial<Record<"request" | "confirm" | "resend" | "cancel" | "password", () => Answer>>;

export type ProfileOptions = {
  profile?: ProfileResponse;
  answers?: ProfileAnswers;
  sessions?: SessionItem[];
  signins?: SignInRow[];
  /** The address a request is for and a confirmation lands on (default `NEW_EMAIL`). */
  newEmail?: string;
};

/** Registers the profile routes (after `mockAuth`). */
export async function serveProfile(page: Page, options: ProfileOptions = {}) {
  const calls: ProfileCall[] = [];
  const answers = options.answers ?? {};
  const pending = () => pendingChange({ email: options.newEmail ?? NEW_EMAIL });
  const state = { profile: options.profile ?? profile(), sessions: options.sessions ?? [ownSession(11, "Chrome · Linux", { current: true })], signins: options.signins ?? [ownSignin(1, "signed_in")] };

  await page.route("**/api/v1/iam/profile**", (route) => {
    const { method, path, body } = readRequest(route);
    if (method !== "GET") calls.push({ method, path, body: body ?? null });

    if (path === "/iam/profile" && method === "GET") return route.fulfill(json(ok(state.profile)));
    if (path === "/iam/profile/email" && method === "POST") {
      if (answers.request) return route.fulfill(answers.request());
      state.profile = { ...state.profile, pending_email: pending() };
      return route.fulfill(json(ok(pending())));
    }
    if (path === "/iam/profile/email/resend") return route.fulfill(answers.resend ? answers.resend() : json(ok(pending())));
    if (path === "/iam/profile/email/confirm") {
      if (answers.confirm) return route.fulfill(answers.confirm());
      state.profile = { ...state.profile, email: options.newEmail ?? NEW_EMAIL, pending_email: null };
      return route.fulfill(json(ok(state.profile)));
    }
    if (path === "/iam/profile/email" && method === "DELETE") {
      if (answers.cancel) return route.fulfill(answers.cancel());
      state.profile = { ...state.profile, pending_email: null };
      return route.fulfill(noContent());
    }
    if (path === "/iam/profile/password") return route.fulfill(answers.password ? answers.password() : noContent());
    if (path === "/iam/profile/sessions" && method === "GET") return route.fulfill(json(ok({ sessions: state.sessions } satisfies SessionList)));
    const own = /^\/iam\/profile\/sessions\/(\d+)$/.exec(path);
    if (own && method === "DELETE") {
      state.sessions = state.sessions.filter((s) => s.id !== Number(own[1]));
      return route.fulfill(noContent());
    }
    if (path === "/iam/profile/signins") return route.fulfill(json(datatable(state.signins)));
    return route.fallback();
  });

  return { calls, state };
}
