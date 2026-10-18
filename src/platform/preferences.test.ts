import { describe, expect, it } from "vitest";
import { createTestPlatform, createTestSession } from "../testing/platform";
import { deferred } from "../testing/async";
import { jsonResponse, routedTransport, scriptedTransport } from "../testing/transport";
import { parseSessionPayload } from "./httpSession";
import { mergePatch, preferencesOf } from "./preferences";

type Prefs = { dark_mode?: boolean; onboarding?: { welcome_done?: boolean; tips_dismissed?: string[] } };
const ok = (preferences: object) => jsonResponse(200, { success: true, data: { preferences } });
const body = (call: { init: RequestInit }) => JSON.parse(String(call.init.body));

describe("mergePatch (RFC 7396)", () => {
  it("merges objects, replaces arrays and scalars, deletes on null", () => {
    expect(mergePatch({ a: { b: 1, c: 2 }, tips: ["x"], keep: 1 }, { a: { b: null, d: 3 }, tips: ["y"] })).toEqual({ a: { c: 2, d: 3 }, tips: ["y"], keep: 1 });
  });

  it("replaces a non-object by an object without its null members, and does not touch its inputs", () => {
    const target = { a: 1 };
    expect(mergePatch(target, { a: { x: null, y: 2 } })).toEqual({ a: { y: 2 } });
    expect(target).toEqual({ a: 1 });
  });

  it("never lets a key reach the prototype", () => {
    const patch = JSON.parse('{"__proto__":{"polluted":true}}');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(mergePatch({}, patch))).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("the session payload", () => {
  const payload = { user: { id: 1 }, access: { root: false, permissions: {}, unavailable: [] } };

  it("carries its preferences, and an absent bag is empty", () => {
    expect(parseSessionPayload({ ...payload, preferences: { dark_mode: true } }).preferences).toEqual({ dark_mode: true });
    expect(parseSessionPayload(payload).preferences).toEqual({});
  });

  it("reads preferences that are not an object as none", () => {
    expect(parseSessionPayload({ ...payload, preferences: [1] }).preferences).toEqual({});
    expect(parseSessionPayload({ ...payload, preferences: null }).preferences).toEqual({});
  });
});

describe("preferencesOf", () => {
  it("reads the session's preferences, empty when the session has none", () => {
    expect(preferencesOf<Prefs>(createTestPlatform({ preferences: { dark_mode: true } })).value.value).toEqual({ dark_mode: true });
    expect(preferencesOf<Prefs>(createTestPlatform()).value.value).toEqual({});
    expect(preferencesOf<Prefs>(createTestPlatform({ user: null })).value.value).toEqual({});
  });

  it("is one per platform", () => {
    const platform = createTestPlatform();
    expect(preferencesOf(platform)).toBe(preferencesOf(platform));
    expect(preferencesOf(createTestPlatform())).not.toBe(preferencesOf(platform));
  });

  it("applies a patch at once, PUTs it, and replaces the value by the server's merged answer", async () => {
    const answer = deferred<Response>();
    const { transport, calls } = routedTransport({ "PUT /v1/auth/preferences": () => answer.promise });
    const platform = createTestPlatform({ transport, preferences: { dark_mode: false, onboarding: { welcome_done: true } } });
    const preferences = preferencesOf<Prefs>(platform);

    const saving = preferences.save({ dark_mode: true, onboarding: { tips_dismissed: ["a"] } });
    expect(preferences.value.value).toEqual({ dark_mode: true, onboarding: { welcome_done: true, tips_dismissed: ["a"] } }); // before the answer
    await Promise.resolve();
    await Promise.resolve();
    expect(calls.map((call) => body(call))).toEqual([{ preferences: { dark_mode: true, onboarding: { tips_dismissed: ["a"] } } }]);

    answer.resolve(ok({ dark_mode: true, onboarding: { welcome_done: true, tips_dismissed: ["z", "a"] } })); // the server's own merge
    await saving;
    expect(preferences.value.value).toEqual({ dark_mode: true, onboarding: { welcome_done: true, tips_dismissed: ["z", "a"] } });
  });

  it("rolls back and rejects when the server refuses, keeping the person's other pending saves", async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    const { transport } = scriptedTransport(() => first.promise, () => second.promise);
    const platform = createTestPlatform({ transport, preferences: { dark_mode: false } });
    const preferences = preferencesOf<Prefs>(platform);

    const a = preferences.save({ dark_mode: true });
    const b = preferences.save({ onboarding: { welcome_done: true } });
    const aOutcome = a.then(() => "saved", () => "refused");
    expect(preferences.value.value).toEqual({ dark_mode: true, onboarding: { welcome_done: true } });

    first.resolve(jsonResponse(500, { success: false, error: { code: "boom" } }));
    expect(await aOutcome).toBe("refused");
    expect(preferences.value.value).toEqual({ dark_mode: false, onboarding: { welcome_done: true } }); // only the first is undone

    second.resolve(ok({ dark_mode: false, onboarding: { welcome_done: true } }));
    await b;
    expect(preferences.value.value).toEqual({ dark_mode: false, onboarding: { welcome_done: true } });
  });

  it("sends the saves one after the other", async () => {
    const first = deferred<Response>();
    const { transport, calls } = scriptedTransport(() => first.promise, ok({ dark_mode: true, onboarding: { welcome_done: true } }));
    const preferences = preferencesOf<Prefs>(createTestPlatform({ transport }));

    const a = preferences.save({ dark_mode: true });
    const b = preferences.save({ onboarding: { welcome_done: true } });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(calls).toHaveLength(1); // the second waits for the first

    first.resolve(ok({ dark_mode: true }));
    await Promise.all([a, b]);
    expect(calls.map((call) => body(call).preferences)).toEqual([{ dark_mode: true }, { onboarding: { welcome_done: true } }]);
    expect(preferences.value.value).toEqual({ dark_mode: true, onboarding: { welcome_done: true } });
  });

  it("deletes a key with null", async () => {
    const { transport, calls } = scriptedTransport(ok({ onboarding: {} }));
    const preferences = preferencesOf<Prefs>(createTestPlatform({ transport, preferences: { dark_mode: true, onboarding: {} } }));
    const saving = preferences.save({ dark_mode: null as never });
    expect(preferences.value.value).toEqual({ onboarding: {} });
    await saving;
    expect(body(calls[0]!)).toEqual({ preferences: { dark_mode: null } });
  });

  it("asks nothing and changes nothing when nobody is signed in", async () => {
    const { transport, calls } = scriptedTransport(ok({}));
    const preferences = preferencesOf<Prefs>(createTestPlatform({ transport, user: null }));
    await preferences.save({ dark_mode: true });
    expect(calls).toHaveLength(0);
    expect(preferences.value.value).toEqual({});
  });

  it("does not hand the answer to somebody else who signed in meanwhile", async () => {
    const answer = deferred<Response>();
    const { transport } = scriptedTransport(() => answer.promise);
    const platform = createTestPlatform({ transport, user: { id: 1 }, preferences: { dark_mode: false } });
    const preferences = preferencesOf<Prefs>(platform);
    const saving = preferences.save({ dark_mode: true });

    platform.session.establish(createTestSession({ user: { id: 2 }, preferences: { dark_mode: false } }));
    answer.resolve(ok({ dark_mode: true }));
    await saving;
    expect(preferences.value.value).toEqual({ dark_mode: false });
  });
});
