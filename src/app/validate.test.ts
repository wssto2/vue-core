import { describe, expect, it } from "vitest";
import { createApplication } from "./application";
import { defineFeatureContext, platformKey } from "../platform";
import { localeMessages } from "../i18n";
import { defineFeature, provideContext } from "./feature";
import { ApplicationError } from "./validate";
import { fakeBackend, options, page } from "./testing";

const { platform } = fakeBackend(null, { capabilities: ["tickets"] });
const login = defineFeature({ id: "login", routes: [{ name: "login", path: "/login", component: page("login"), meta: { public: true } }] });
const [A] = defineFeatureContext<string>("test.a");
const loader = { en: async () => ({ default: {} }) };

function issuesOf(features: unknown[], extra = {}, where = platform): { owner: string; message: string }[] {
  try {
    createApplication(options(where, features as never, "/", extra));
  } catch (error) {
    if (error instanceof ApplicationError) return [...error.issues];
    throw error;
  }
  return [];
}

describe("createApplication validates the composition at startup", () => {
  it("accepts a sound composition", () => {
    expect(issuesOf([login, defineFeature({ id: "tickets", routes: [{ name: "tickets", path: "/tickets", component: page("t") }], backend: ["tickets"] })])).toEqual([]);
  });

  it("names the owner of every problem and reports them all at once", () => {
    const one = defineFeature({ id: "one", routes: [{ name: "x", path: "/x", component: page("x") }], context: provideContext(A, "1"), messages: localeMessages("shared", loader) });
    const two = defineFeature({ id: "two", routes: [{ name: "x", path: "/y", component: page("y") }], context: provideContext(A, "2"), messages: localeMessages("shared", loader) });

    let thrown: ApplicationError | undefined;
    try {
      createApplication(options(platform, [login, one, two]));
    } catch (error) {
      thrown = error as ApplicationError;
    }

    expect(thrown).toBeInstanceOf(ApplicationError);
    expect(thrown!.issues).toEqual([
      { owner: 'feature "two"', message: 'declares the route name "x", which feature "one" declares too.' },
      { owner: 'feature "two"', message: 'provides the context "test.a", which feature "one" provides too.' },
      { owner: 'feature "two"', message: 'declares the message namespace "shared", which feature "one" declares too.' },
    ]);
    expect(thrown!.message).toContain('[feature "two"] declares the route name "x"');
  });

  it("rejects duplicate feature ids, a value that is not from defineFeature, and identical top-level paths", () => {
    const a = defineFeature({ id: "a", routes: [{ name: "a", path: "/same", component: page("a") }] });
    const b = defineFeature({ id: "a", routes: [{ name: "b", path: "/same/", component: page("b") }] });

    expect(issuesOf([login, a, b, { id: "plain" }])).toEqual([
      { owner: "application", message: "features[3] was not created with defineFeature()." },
      { owner: 'feature "a"', message: 'the feature id "a" is used twice in the features list.' },
      { owner: 'feature "a"', message: 'declares the path "/same/", which feature "a" declares too.' },
    ]);
  });

  it("rejects a context the runtime provides itself", () => {
    const hijack = defineFeature({ id: "hijack", context: provideContext(platformKey, platform) });
    expect(issuesOf([login, hijack]).map((issue) => issue.message)).toEqual(['provides the context "platform", which the runtime provides itself.']);
  });

  it("checks required features (missing, cyclic) and backend capabilities", () => {
    const needs = defineFeature({ id: "needs", requires: ["missing"], backend: ["billing"] });
    const p = defineFeature({ id: "p", requires: ["q"] });
    const q = defineFeature({ id: "q", requires: [p] });

    expect(issuesOf([login, needs, p, q]).map((issue) => `${issue.owner}: ${issue.message}`)).toEqual([
      'feature "needs": requires the feature "missing", which is not in the features list.',
      'feature "p": requirements form a cycle: p -> q -> p.',
      'feature "needs": needs the backend capability "billing", which the server does not report.',
    ]);
  });

  it("checks message namespaces: locales, reserved names, route and contribution dependencies", () => {
    const f = defineFeature({
      id: "f",
      routes: [{ name: "f", path: "/f", component: page("f"), meta: { messages: ["nobody"] } }],
      messages: localeMessages("f", { ...loader, de: async () => ({ default: {} }) }),
      contributions: [{ id: "bell", slot: "headerActions", component: page("b"), scope: "always", messages: ["alsonobody"] }],
    });

    expect(issuesOf([login, f]).map((issue) => issue.message)).toEqual([
      'the namespace "f" has a loader for "de", which is not a supported locale (en, hr, bs, sl).',
      'the route "f" needs the message namespace "nobody", which nobody declares.',
      'the contribution "bell" needs the message namespace "alsonobody", which nobody declares.',
    ]);
  });

  it("checks contributions against the slots the shell renders, and their ids", () => {
    const one = defineFeature({ id: "one", contributions: [{ id: "c", slot: "headerActions", component: page("c"), scope: "always" }, { id: "soft", slot: "accountMenu", component: page("s"), scope: "always", optional: true }] });
    const two = defineFeature({ id: "two", contributions: [{ id: "c", slot: "host", component: page("d"), scope: "authenticated" }] });

    expect(issuesOf([login, one, two], { shell: { component: page("shell"), slots: ["host"] } }).map((issue) => `${issue.owner}: ${issue.message}`)).toEqual([
      'feature "one": contributes "c" to the slot "headerActions", which the shell does not render (it renders host). Mark it optional to leave it out instead.',
      'feature "two": declares the shell contribution "c", which feature "one" declares too.',
    ]);
  });

  it("checks effect ids", () => {
    const effect = { id: "tick", scope: "app" as const, start: () => {} };
    expect(issuesOf([login, defineFeature({ id: "one", effects: [effect] }), defineFeature({ id: "two", effects: [effect] })]).map((issue) => issue.message)).toEqual([
      'declares the effect "tick", which feature "one" declares too.',
    ]);
  });

  describe("navigation destinations", () => {
    const tickets = defineFeature({ id: "tickets", routes: [{ name: "tickets.index", path: "/tickets", component: page("t") }], navigation: [{ destination: "tickets", to: { name: "tickets.index" } }] });

    it("an unknown destination, a required one nobody binds and one bound twice name their owners", () => {
      const again = defineFeature({ id: "again", navigation: [{ destination: "tickets", to: { name: "tickets.index" } }] });
      expect(issuesOf([login, tickets, again], { navigation: { known: ["reports"], required: ["home"] } }).map((issue) => issue.message)).toEqual([
        'Feature "tickets" binds the destination "tickets", which the backend\'s navigation does not contain.',
        'The destination "tickets" is bound twice: by feature "tickets" and by feature "again".',
        'The destination "home" is required but no feature binds it.',
      ]);
    });

    it("a binding to a route nobody installed is an error, not a broken link", () => {
      const dangling = defineFeature({ id: "dangling", navigation: [{ destination: "gone", to: { name: "nowhere" } }] });
      expect(issuesOf([login, dangling]).map((issue) => `${issue.owner}: ${issue.message}`)).toEqual([
        'feature "dangling": the destination "gone" is bound to {"name":"nowhere"}, which matches no route.',
      ]);
    });
  });

  it("protected routes need a login route that exists and is public", () => {
    const tickets = defineFeature({ id: "tickets", routes: [{ name: "tickets", path: "/tickets", component: page("t") }] });
    const privateLogin = defineFeature({ id: "private", routes: [{ name: "login", path: "/login", component: page("l") }] });

    expect(issuesOf([tickets])[0]!.message).toMatch(/login route \{"name":"login"\} does not exist/);
    expect(issuesOf([privateLogin])[0]!.message).toMatch(/is not public/);
    expect(issuesOf([tickets], { router: { login: { name: "signin" } } })[0]!.message).toMatch(/login route \{"name":"signin"\} does not exist/);
    expect(issuesOf([defineFeature({ id: "open", routes: [{ name: "open", path: "/open", component: page("o"), meta: { public: true } }] })])).toEqual([]); // nothing protected, no login needed
  });

  it("checks the locales", () => {
    expect(issuesOf([login], { locale: { fallback: "de" } }).map((issue) => issue.message)).toEqual([
      'the fallback locale "de" is not among the supported locales (en, hr, bs, sl).',
    ]);
  });
});
