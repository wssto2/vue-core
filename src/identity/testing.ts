import { createMemoryHistory } from "vue-router";
import { createApplication, defineFeature, type Application, type Feature } from "../app";
import { createPlatform, parseBootstrap } from "../platform";
import { backofficeShell } from "../shell";
import { jsonResponse, routedTransport, settle, type Answer, type RecordedCall } from "../testing";
import { identityFeature } from "./feature";
import { identityPlatform } from "./session";
import { usersFeature, type UsersFeatureOptions } from "./users/feature";

// The identity screens as an application runs them, around a fake server: every test mounts the whole application (the
// real shell, router, guards, leave guard and i18n) and drives it through the DOM. Not shipped: excluded from the build.
const running: { application: Application; target: HTMLElement }[] = [];

/** Stops every application a test started; call it from `afterEach`. */
export function stopApplications(): void {
  for (const { application, target } of running.splice(0)) {
    application.dispose();
    target.remove();
  }
}

const organization = { scope: { level: "organization" }, qualifier: "all", clauses: [{ scope: { level: "organization" }, qualifier: "all" }] };

/** The answer of go-core's `/auth/me` for a person who holds `permissions` at the organization. */
export function sessionOf(user: { id: number; name: string; login?: string; locale?: string }, permissions: readonly string[], extra: object = {}) {
  return {
    success: true,
    data: {
      user: { id: user.id, login: user.login ?? user.name.toLowerCase(), name: user.name, email: `${user.name.toLowerCase()}@example.test`, locale: user.locale ?? "en" },
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      access: { subject: { kind: "user", id: user.id }, root: false, permissions: Object.fromEntries(permissions.map((permission) => [permission, organization])) },
      navigation: [],
      ...extra,
    },
  };
}

/** A list answer as go-core's datatable sends it (inside the envelope). */
export const listOf = (rows: readonly object[], extra: object = {}) =>
  jsonResponse(200, { success: true, data: { data: rows, total: rows.length, per_page: 25, current_page: 1, last_page: 1, from: rows.length === 0 ? 0 : 1, to: rows.length, ...extra } });

/** A plain answer: `{ success: true, data }`. */
export const dataOf = (data: unknown) => jsonResponse(200, { success: true, data });

/** A refusal as go-core sends it: a reason (`code`), its params, and the fields it complains about. */
export const refusal = (status: number, code: string, extra: { params?: object; fields?: Record<string, string> } = {}) =>
  jsonResponse(status, { success: false, error: code, code, ...(extra.params ? { params: extra.params } : {}), ...(extra.fields ? { fields: extra.fields } : {}) });

export interface ScreenOptions {
  /** Who is signed in. Default Ana (id 1). */
  user?: { id: number; name: string; login?: string; locale?: string };
  permissions: readonly string[];
  /** Where the router starts. */
  location: string;
  /** The fake server's other answers, by `"METHOD /path"`. */
  answers: Readonly<Record<string, Answer>>;
  users?: UsersFeatureOptions;
  /** Features of the test's own (pages to navigate to). */
  features?: readonly Feature[];
  /** The application's own texts per locale (`{ en: { errors: { "crm.owns_leads": "…" } } }`), over the library's. */
  messages?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

/** Starts the application with the users feature on a fake server and waits until it settles. */
export async function startScreen(options: ScreenOptions) {
  const me = sessionOf(options.user ?? { id: 1, name: "Ana" }, options.permissions);
  const { transport, calls } = routedTransport({
    "GET /api/v1/auth/me": jsonResponse(200, me),
    "POST /api/v1/auth/refresh": jsonResponse(401, { success: false, error: "no", code: "identity.session.invalid" }),
    ...Object.fromEntries(Object.entries(options.answers).map(([key, answer]) => [key.replace(" /", " /api/"), answer])),
  });
  const platform = createPlatform({ config: parseBootstrap({ locale: "en", app_name: "Test", api_base: "/api" }), transport, ...identityPlatform() });
  const history = createMemoryHistory();
  history.replace(options.location);
  const application = createApplication({
    platform,
    shell: backofficeShell(),
    features: [identityFeature(), usersFeature(options.users), defineFeature({ id: "pages", routes: [{ name: "home", path: "/", component: { render: () => null } }] }), ...(options.features ?? [])],
    router: { history },
    locale: { supported: ["en", "hr"], fallback: "en" },
    i18n: { missingWarn: false, ...(options.messages ? { messages: options.messages } : {}) },
  });
  const target = document.createElement("div");
  document.body.append(target);
  running.push({ application, target });
  await application.mount(target);
  await settle();
  return { application, target, platform, calls };
}

/** The calls of a method and path (without the API base and the query). */
export const callsTo = (calls: readonly RecordedCall[], method: string, path: string) =>
  calls.filter((call) => call.method === method && new URL(call.url, "http://test.invalid").pathname === `/api${path}`);
