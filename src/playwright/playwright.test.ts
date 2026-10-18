import { describe, expect, it } from "vitest";
import { parseSessionPayload } from "../platform";
import {
  ORGANIZATION, accessOf, authBody, bindingOf, change, datatable, defaultUser, device, freshState, invalid, mockAuth, notification, ok, ownSession, pageOk, person,
  profile, refusal, role, scopeOf, serveAccess, serveNotifications, serveProfile, serveUsers, serviceAccount, session, setting, signin,
} from "./index";
import { stubPage } from "./testing";

describe("the envelope", () => {
  it("wraps data in go-core's success envelope, with meta only when given", () => {
    expect(ok({ a: 1 })).toEqual({ success: true, data: { a: 1 } });
    expect(ok([], { total: 0 })).toEqual({ success: true, data: [], meta: { total: 0 } });
  });

  it("pages rows with their numbers in meta, and a datatable with them in data", () => {
    expect(pageOk([1, 2], { page: 2 }).meta).toEqual({ total: 2, page: 2, per_page: 20, last_page: 1, from: 1, to: 2 });
    expect(datatable([], [{ key: "all", count: 0 }]).data).toMatchObject({ data: [], total: 0, from: 0, to: 0, meta: { views: [{ key: "all", count: 0 }] } });
  });

  it("builds a refusal with the code, its params and its field", () => {
    expect(refusal(422, "x.bad", { params: { n: 1 }, field: "email" }).body).toBe(JSON.stringify({ success: false, error: "x.bad", code: "x.bad", params: { n: 1 }, fields: { email: "x.bad" } }));
  });
});

describe("mockAuth", () => {
  it("answers /auth/me with the neutral user and a session the library's own parser accepts", async () => {
    const { page, request } = stubPage();
    await mockAuth(page, ["a.b:view"], { access: { "a.b:view": "own_location" }, scope: { level: "dealer", id: 1 }, navigation: [{ i18n: "nav.home" }] });
    const reply = await request("GET", "/api/v1/auth/me");
    const session = parseSessionPayload((reply?.json as { data: unknown }).data);
    expect(session.user).toMatchObject({ id: 1 });
    expect((reply?.json as { data: { user: unknown } }).data.user).toEqual(defaultUser);
    expect(session.access.permissions["a.b:view"]).toEqual({ scope: { level: "dealer", id: 1 }, qualifier: "own_location", clauses: [] });
    expect(session.access.root).toBe(false);
  });

  it("merges the application's own fields over the default user", async () => {
    const { page, request } = stubPage();
    await mockAuth(page, [], { user: { name: "Ana", account_type_id: 7 } });
    const user = ((await request("GET", "/api/v1/auth/me"))?.json as { data: { user: Record<string, unknown> } }).data.user;
    expect(user).toEqual({ ...defaultUser, name: "Ana", account_type_id: 7 });
  });

  it("holds permissions at the organization, as root, by default", () => {
    expect(accessOf(["a:b"])).toEqual({ subject: { kind: "user", id: 1 }, root: true, permissions: { "a:b": { scope: { level: "organization" }, qualifier: "all", clauses: [] } } });
    expect(authBody([], { impersonator: { id: 2, name: "Boss" } }).data).toMatchObject({ impersonator: { id: 2, name: "Boss" }, expires_at: "2099-01-01T00:00:00.000Z" });
  });
});

const admin = role("admin", { name: "Administrator", grants: [{ permission: "crm.lead:view", qualifier: "all" }] });
const sales = role("salesused", { grants: [{ permission: "crm.lead:view", qualifier: "own" }] });
const places = { root_level: "organization", root: true, places: [{ level: "dealer", id: 1, name: "Zagreb", parent_level: "organization", parent_id: null }] };

describe("serveAccess", () => {
  it("lists, creates, reads and deletes roles, numbering the next one after the highest id", async () => {
    const { page, request } = stubPage();
    const wire = await serveAccess(page, { roles: [admin, role("9")] });
    expect((await request("GET", "/api/v1/iam/roles"))?.json).toMatchObject({ data: { roles: [{ ref: "admin" }, { ref: "9" }] } });
    const created = await request("POST", "/api/v1/iam/roles", { name: "New", description: "", grants: [], attrs: [] });
    expect(created).toMatchObject({ status: 201, json: { data: { ref: "10", id: 10, name: "New" } } });
    expect((await request("DELETE", "/api/v1/iam/roles/10"))?.status).toBe(204);
    expect(wire.roles.map((r) => r.ref)).toEqual(["admin", "9"]);
    expect(wire.calls.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /iam/roles", "DELETE /iam/roles/10"]);
    expect(wire.reads).toEqual(["/iam/roles"]);
  });

  it("compares two roles and answers an unknown one with 404", async () => {
    const { page, request } = stubPage();
    await serveAccess(page, { roles: [admin, sales] });
    expect((await request("GET", "/api/v1/iam/roles/admin/compare?with=salesused"))?.json).toMatchObject({ data: { different: [{ permission: "crm.lead:view", role: "all", other: "own" }] } });
    expect((await request("GET", "/api/v1/iam/roles/nobody"))?.status).toBe(404);
  });

  it("binds a role at a place, reads the access back with its effective grants, and unbinds", async () => {
    const { page, request } = stubPage();
    const wire = await serveAccess(page, { roles: [sales], places, bindings: { "user:3": [bindingOf(4, sales, scopeOf("dealer", 1, "Zagreb"))] } });
    const added = await request("POST", "/api/v1/iam/users/3/bindings", { role_ref: "salesused", level: "dealer", scope_id: 1 });
    expect(added).toMatchObject({ status: 201, json: { data: { id: 5, scope: { level: "dealer", id: 1, name: "Zagreb" } } } });
    expect((await request("GET", "/api/v1/iam/users/3/access"))?.json).toMatchObject({ data: { subject: { kind: "user", id: 3 }, can_manage: true, effective: [{ permission: "crm.lead:view", grants: [{ binding_id: 4 }, { binding_id: 5 }] }] } });
    await request("DELETE", "/api/v1/iam/users/3/bindings/4");
    expect(wire.bindings["user:3"]?.map((b) => b.id)).toEqual([5]);
    expect((await request("GET", "/api/v1/iam/service-accounts/21/scopes"))?.json).toMatchObject({ data: places });
    expect((await request("POST", "/api/v1/iam/users/3/bindings", { role_ref: "salesused", level: "organization" }))?.json).toMatchObject({ data: { scope: ORGANIZATION } });
  });

  it("offers the predefined roles as bindable unless told otherwise, and a hook answers first", async () => {
    const { page, request } = stubPage();
    await serveAccess(page, { roles: [admin, role("9")], hook: async (route, _url, method) => (method === "GET" ? false : (await route.fulfill(invalid([{ code: "authz.x" }])), true)) });
    expect((await request("GET", "/api/v1/iam/bindable-roles"))?.json).toMatchObject({ data: { roles: [{ ref: "admin" }] } });
    expect(await request("POST", "/api/v1/iam/roles", {})).toMatchObject({ status: 400, json: { code: "authz.invalid", params: { problems: [{ code: "authz.x" }] } } });
  });

  it("leaves the paths that are not its own", async () => {
    const { page, request } = stubPage();
    await serveAccess(page);
    expect(await request("GET", "/api/v1/iam/users/3/signins")).toBeUndefined();
  });
});

describe("serveNotifications", () => {
  it("serves the inbox, counts what is unread and marks items read", async () => {
    const { page, request } = stubPage();
    const wire = await serveNotifications(page, { items: [notification(2, "Two"), notification(1, "One"), notification(0, "Old", { read: true })] });
    expect((await request("GET", "/api/v1/notifications"))?.json).toMatchObject({ data: { items: [{ id: 2 }, { id: 1 }, { id: 0 }], has_more: false } });
    expect((await request("GET", "/api/v1/notifications?before_id=2"))?.json).toMatchObject({ data: { items: [{ id: 1 }, { id: 0 }] } });
    expect((await request("GET", "/api/v1/notifications/unread"))?.json).toMatchObject({ data: { unread_count: 2 } });
    expect((await request("POST", "/api/v1/notifications/1/read"))?.json).toMatchObject({ data: { unread_count: 1 } });
    expect((await request("POST", "/api/v1/notifications/read", { up_to_id: 2 }))?.json).toMatchObject({ data: { unread_count: 0 } });
    expect(wire.calls).toEqual([{ method: "POST", path: "/1/read", body: undefined }, { method: "POST", path: "/read", body: { up_to_id: 2 } }]);
  });

  it("fails the list on demand and streams its events", async () => {
    const { page, request } = stubPage();
    let failing = true;
    const wire = await serveNotifications(page, { failList: () => failing });
    expect((await request("GET", "/api/v1/notifications"))?.status).toBe(500);
    failing = false;
    expect((await request("GET", "/api/v1/notifications"))?.status).toBe(200);
    const stream = await request("GET", "/api/v1/notifications/stream");
    expect(stream).toMatchObject({ contentType: "text/event-stream", text: `data: ${JSON.stringify({ type: "unread", unread_count: 0 })}\n\n` });
    expect(wire.streams).toBe(1);
  });

  it("keeps the preferences, quiet hours and devices as state", async () => {
    const { page, request } = stubPage();
    const wire = await serveNotifications(page, {
      categories: [{ category: "lead.assigned", email: setting(true), push: setting(true) }],
      devices: [device(2, "Phone")], registers: device(1, "Mac", { platform: "macos" }), timeZone: "Europe/Zagreb",
    });
    expect((await request("GET", "/api/v1/notifications/preferences"))?.json).toMatchObject({ data: { time_zone: "Europe/Zagreb", quiet_hours: { start: 1260, end: 420 }, categories: [{ category: "lead.assigned" }] } });
    await request("PUT", "/api/v1/notifications/preferences/lead.assigned", { email: false });
    await request("PUT", "/api/v1/notifications/preferences/lead.assigned/push", { push: false });
    expect(wire.categories[0]).toMatchObject({ email: { enabled: false, source: "person" }, push: { enabled: false, source: "person" } });
    await request("PUT", "/api/v1/notifications/quiet-hours", { enabled: false, start: 0, end: 0 });
    expect(wire.quiet.enabled).toBe(false);
    expect((await request("POST", "/api/v1/notifications/devices", {}))?.json).toMatchObject({ data: { id: 1, label: "Mac" } });
    expect(wire.devices.map((d) => d.id)).toEqual([1, 2]);
    expect((await request("PATCH", "/api/v1/notifications/devices/2", { label: "Tablet" }))?.json).toMatchObject({ data: { label: "Tablet" } });
    await request("DELETE", "/api/v1/notifications/devices/2");
    expect(wire.devices.map((d) => d.id)).toEqual([1]);
    expect((await request("POST", "/api/v1/notifications/devices/unsubscribe", {}))?.json).toMatchObject({ data: { items: [] } });
  });
});

describe("serveProfile", () => {
  it("runs the e-mail change: request, confirm, and the record shows the new address", async () => {
    const { page, request } = stubPage();
    const served = await serveProfile(page, { newEmail: "new@x.test" });
    expect((await request("POST", "/api/v1/iam/profile/email", { email: "new@x.test" }))?.json).toMatchObject({ data: { email: "new@x.test", attempts_left: 3 } });
    expect((await request("GET", "/api/v1/iam/profile"))?.json).toMatchObject({ data: { pending_email: { email: "new@x.test" } } });
    expect((await request("POST", "/api/v1/iam/profile/email/confirm", { code: "123456" }))?.json).toMatchObject({ data: { email: "new@x.test", pending_email: null } });
    expect(served.calls.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /iam/profile/email", "POST /iam/profile/email/confirm"]);
  });

  it("answers an endpoint as the spec says, and reports every write with its body", async () => {
    const { page, request } = stubPage();
    const served = await serveProfile(page, { answers: { password: () => refusal(422, "identity.password.wrong", { field: "current_password" }) } });
    expect(await request("PUT", "/api/v1/iam/profile/password", { current_password: "x" })).toMatchObject({ status: 422, json: { code: "identity.password.wrong" } });
    expect(served.calls).toEqual([{ method: "PUT", path: "/iam/profile/password", body: { current_password: "x" } }]);
    expect((await request("DELETE", "/api/v1/iam/profile/email"))?.status).toBe(204);
  });

  it("lists and revokes the person's own sessions and lists the sign-ins", async () => {
    const { page, request } = stubPage();
    await serveProfile(page, { profile: profile({ name: "Ana" }), sessions: [ownSession(1, "Mac", { current: true }), ownSession(2, "Phone")] });
    expect((await request("GET", "/api/v1/iam/profile"))?.json).toMatchObject({ data: { name: "Ana" } });
    await request("DELETE", "/api/v1/iam/profile/sessions/2");
    expect((await request("GET", "/api/v1/iam/profile/sessions"))?.json).toMatchObject({ data: { sessions: [{ id: 1 }] } });
    expect((await request("GET", "/api/v1/iam/profile/signins"))?.json).toMatchObject({ data: { data: [{ event: "signed_in" }], total: 1 } });
  });

  it("leaves a route the application adds under iam/profile to the application", async () => {
    const { page, request } = stubPage();
    await serveProfile(page);
    expect(await request("GET", "/api/v1/iam/profile/account")).toBeUndefined();
    await page.route("**/api/v1/iam/profile/account", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok({ mobile: "1" })) }));
    expect((await request("GET", "/api/v1/iam/profile/account"))?.json).toMatchObject({ data: { mobile: "1" } });
    expect((await request("GET", "/api/v1/iam/profile"))?.status).toBe(200);
  });
});

describe("serveUsers", () => {
  const people = [person(3, "Ana Horvat"), person(4, "Ivan Babic", { status: "locked", locked_until: "2099-01-01T00:00:00Z" }), person(5, "Dario Simic", { active: false, status: "inactive" })];

  it("lists by view and search with the count of every view", async () => {
    const { page, request } = stubPage();
    await serveUsers(page, { state: freshState({ people }) });
    const active = (await request("GET", "/api/v1/iam/users"))?.json as { data: { data: { id: number }[]; meta: { views: unknown } } };
    expect(active.data.data.map((p) => p.id)).toEqual([3]);
    expect(active.data.meta.views).toEqual([{ key: "active", count: 1 }, { key: "locked", count: 1 }, { key: "inactive", count: 1 }, { key: "all", count: 3 }]);
    expect(((await request("GET", "/api/v1/iam/users?view=all&search=iv"))?.json as { data: { data: unknown[] } }).data.data).toHaveLength(1);
  });

  it("lets the application filter the list by its own parameters", async () => {
    const { page, request } = stubPage();
    await serveUsers(page, { state: freshState({ people }), filter: (p, params) => !params.get("name_starts") || p.name.startsWith(params.get("name_starts")!) });
    expect(((await request("GET", "/api/v1/iam/users?view=all&name_starts=Da"))?.json as { data: { data: { id: number }[] } }).data.data.map((p) => p.id)).toEqual([5]);
  });

  it("reads, creates, updates (merging ext) and unlocks a person, reporting each write", async () => {
    const { page, request } = stubPage();
    const { writes, state } = await serveUsers(page, { state: freshState({ people: [person(3, "Ana Horvat", { ext: { dealer_id: 1, city: "Split" } }), people[1]!] }) });
    expect((await request("GET", "/api/v1/iam/users/3"))?.json).toMatchObject({ data: { id: 3, name: "Ana Horvat" } });
    expect((await request("POST", "/api/v1/iam/users", { name: "Nova Osoba", login: "nova", email: "n@x.test", locale: "en" }))?.json).toMatchObject({ data: { id: 5, name: "Nova Osoba", login: "nova" } });
    expect((await request("PUT", "/api/v1/iam/users/3", { name: "Ana H.", ext: { dealer_id: 2 } }))?.json).toMatchObject({ data: { name: "Ana H.", ext: { dealer_id: 2, city: "Split" } } });
    expect((await request("POST", "/api/v1/iam/users/4/unlock"))?.json).toMatchObject({ data: { unlocked: true } });
    expect(state.people.find((p) => p.id === 4)).toMatchObject({ status: "active", locked_until: null });
    expect(writes.map((w) => `${w.method} ${w.path}`)).toEqual(["POST /iam/users", "PUT /iam/users/3", "POST /iam/users/4/unlock"]);
    expect(writes[2]?.body).toBeNull();
  });

  it("serves sessions, sign-ins with the failed view, changes and activity", async () => {
    const { page, request } = stubPage();
    const { state } = await serveUsers(page, {
      state: freshState({ sessions: [session(1, "Mac"), session(2, "Phone")], signins: [signin(1, "signed_in"), signin(2, "wrong_password")], changes: [change(1, "updated")] }),
    });
    await request("DELETE", "/api/v1/iam/users/3/sessions/1");
    expect(state.sessions.map((s) => s.id)).toEqual([2]);
    expect(((await request("GET", "/api/v1/iam/users/3/signins?view=failed"))?.json as { data: { data: unknown[]; meta: { views: unknown } } }).data).toMatchObject({ data: [{ id: 2 }], meta: { views: [{ key: "all", count: 2 }, { key: "failed", count: 1 }] } });
    expect((await request("GET", "/api/v1/iam/users/3/changes"))?.json).toMatchObject({ data: { data: [{ action: "updated" }], total: 1 } });
    await request("DELETE", "/api/v1/iam/users/3/sessions");
    expect(state.sessions).toEqual([]);
  });

  it("answers 404 to manage actions on a person that is seen but not managed", async () => {
    const { page, request } = stubPage();
    await serveUsers(page, { state: freshState({ people, notManageable: true }) });
    expect(await request("PUT", "/api/v1/iam/users/3", {})).toMatchObject({ status: 404, json: { code: "identity.account.not_found" } });
    expect((await request("GET", "/api/v1/iam/users/3"))?.status).toBe(200);
  });

  it("refuses a write to a person that is not managed before the hook can answer it", async () => {
    const { page, request } = stubPage();
    const { writes } = await serveUsers(page, { state: freshState({ people, notManageable: true }), hook: () => ({ status: 200, body: "{}" }) });
    expect((await request("POST", "/api/v1/iam/users/3/deactivate", {}))?.status).toBe(404);
    expect((await request("POST", "/api/v1/iam/users", {}))?.status).toBe(200);
    expect(writes.map((w) => w.path)).toEqual(["/iam/users/3/deactivate", "/iam/users"]);
  });

  it("serves the service accounts and their keys", async () => {
    const { page, request } = stubPage();
    await serveUsers(page, { state: freshState({ serviceAccounts: [serviceAccount(21, "DMS")] }) });
    expect((await request("GET", "/api/v1/iam/service-accounts"))?.json).toMatchObject({ data: { service_accounts: [{ id: 21 }] } });
    expect((await request("GET", "/api/v1/iam/service-accounts/21/keys"))?.json).toMatchObject({ data: { keys: [] } });
    expect((await request("GET", "/api/v1/iam/service-accounts/22"))?.status).toBe(404);
  });

  it("lets a hook answer first, leaves other paths alone and reports only what it served", async () => {
    const { page, request } = stubPage();
    const { writes } = await serveUsers(page, { hook: ({ method, path }) => (method === "POST" && path.endsWith("/deactivate") ? { status: 200, contentType: "application/json", body: JSON.stringify(ok({ ext: { moved: 1 } })) } : undefined) });
    expect((await request("POST", "/api/v1/iam/users/3/deactivate"))?.json).toMatchObject({ data: { ext: { moved: 1 } } });
    expect(await request("POST", "/api/v1/iam/users/3/handover", {})).toBeUndefined();
    expect(await request("GET", "/api/v1/iam/users/form-options")).toBeUndefined();
    expect(writes).toEqual([{ method: "POST", path: "/iam/users/3/deactivate", body: null }]);
  });
});
