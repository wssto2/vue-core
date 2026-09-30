import { describe, expect, it, vi } from "vitest";
import { createI18n } from "vue-i18n";
import { deferred } from "../platform/testing";
import { localeMessages } from "./messages";
import { createMessageRuntime, type MessageFailure } from "./runtime";

const module = (messages: Record<string, unknown>) => ({ default: messages });

function setup(loaders: Record<string, Record<string, () => Promise<{ default: Record<string, unknown> }>>>, options: { essential?: string[]; locale?: string } = {}) {
  const i18n = createI18n({ legacy: false, locale: options.locale ?? "en", fallbackLocale: "en", missingWarn: false, fallbackWarn: false, messages: { en: {}, hr: {}, sl: {} } });
  const failures: MessageFailure[] = [];
  const runtime = createMessageRuntime({
    target: i18n.global,
    namespaces: Object.entries(loaders).map(([namespace, byLocale]) => localeMessages(namespace, byLocale, { essential: options.essential?.includes(namespace) })),
    fallback: "en",
    supported: ["en", "hr", "sl"],
    onFailure: (failure) => failures.push(failure),
  });
  return { i18n, runtime, failures, t: i18n.global.t as (key: string) => string };
}

describe("localeMessages", () => {
  it("validates the namespace and keeps `core` for the library", () => {
    expect(() => localeMessages("", {})).toThrow(/not a namespace/);
    expect(() => localeMessages("a b", {})).toThrow(/not a namespace/);
    expect(() => localeMessages("core", {})).toThrow(/belongs to the library/);
    expect(localeMessages("crm.lead", {}).essential).toBe(false);
  });
});

describe("message runtime", () => {
  it("loads a namespace once however many ask at the same moment, nested under its dotted name", async () => {
    const en = vi.fn(async () => module({ title: "Leads" }));
    const { runtime, t } = setup({ "crm.lead": { en } });

    await Promise.all([runtime.load(["crm.lead"]), runtime.load(["crm.lead"])]);
    await runtime.load(["crm.lead"]);

    expect(en).toHaveBeenCalledTimes(1);
    expect(t("crm.lead.title")).toBe("Leads");
  });

  it("loads the fallback locale too, so a missing translation shows the fallback and not a raw key", async () => {
    const { runtime, i18n, t } = setup({ tickets: { en: async () => module({ title: "Tickets", only_en: "English only" }), hr: async () => module({ title: "Tiketi" }) } }, { locale: "hr" });

    await runtime.load(["tickets"]);

    expect(i18n.global.locale.value).toBe("hr");
    expect(t("tickets.title")).toBe("Tiketi");
    expect(t("tickets.only_en")).toBe("English only");
  });

  it("a locale without a loader is not an error: the fallback stands in", async () => {
    const { runtime, failures, t } = setup({ tickets: { en: async () => module({ title: "Tickets" }) } }, { locale: "sl" });

    await runtime.load(["tickets"]);

    expect(failures).toEqual([]);
    expect(t("tickets.title")).toBe("Tickets");
  });

  it("a failed load is reported once, never throws, and is retried by the next need or by retry()", async () => {
    let fail = true;
    const en = vi.fn(async () => {
      if (fail) throw new Error("offline");
      return module({ title: "Tickets" });
    });
    const { runtime, failures, t } = setup({ tickets: { en } });

    await expect(runtime.load(["tickets"])).resolves.toBeUndefined();
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ namespace: "tickets", locale: "en" });
    expect(t("tickets.title")).toBe("tickets.title");

    fail = false;
    await runtime.retry();
    expect(t("tickets.title")).toBe("Tickets");

    fail = true;
    const other = setup({ tickets: { en } });
    await other.runtime.load(["tickets"]);
    fail = false;
    await other.runtime.load(["tickets"]); // the next need tries again
    expect(other.t("tickets.title")).toBe("Tickets");
  });

  it("loadEssential loads only the essential namespaces and says what failed", async () => {
    const shell = vi.fn(async () => module({ menu: "Menu" }));
    const tickets = vi.fn(async () => module({ title: "Tickets" }));
    const broken = vi.fn(async (): Promise<{ default: Record<string, unknown> }> => { throw new Error("x"); });
    const { runtime, t } = setup({ shell: { en: shell }, tickets: { en: tickets }, chrome: { en: broken } }, { essential: ["shell", "chrome"] });

    const failures = await runtime.loadEssential();

    expect(t("shell.menu")).toBe("Menu");
    expect(tickets).not.toHaveBeenCalled();
    expect(failures.map((failure) => failure.namespace)).toEqual(["chrome"]);
  });

  describe("setLocale", () => {
    it("loads what the application already uses in the new locale before it switches: no raw key is ever shown", async () => {
      const gate = deferred<{ default: Record<string, unknown> }>();
      const { runtime, i18n } = setup({ tickets: { en: async () => module({ title: "Tickets" }), hr: () => gate.promise } });
      await runtime.load(["tickets"]);

      const switching = runtime.setLocale("hr");
      await Promise.resolve();
      expect(i18n.global.locale.value).toBe("en"); // still the old one while hr loads

      gate.resolve(module({ title: "Tiketi" }));
      await expect(switching).resolves.toBe(true);
      expect(i18n.global.locale.value).toBe("hr");
      expect(i18n.global.t("tickets.title")).toBe("Tiketi");
    });

    it("a late load for a locale nobody wants any more never commits", async () => {
      const slowHr = deferred<{ default: Record<string, unknown> }>();
      const { runtime, i18n } = setup({ tickets: { en: async () => module({ title: "Tickets" }), hr: () => slowHr.promise, sl: async () => module({ title: "Tiketi (sl)" }) } });
      await runtime.load(["tickets"]);

      const toHr = runtime.setLocale("hr");
      const toSl = runtime.setLocale("sl");
      await expect(toSl).resolves.toBe(true);
      expect(i18n.global.locale.value).toBe("sl");

      slowHr.resolve(module({ title: "Tiketi" }));
      await expect(toHr).resolves.toBe(false);
      expect(i18n.global.locale.value).toBe("sl");
    });

    it("namespaces asked for while the switch loads are loaded in the new locale too", async () => {
      const slowHr = deferred<{ default: Record<string, unknown> }>();
      const { runtime, i18n } = setup({
        tickets: { en: async () => module({ title: "Tickets" }), hr: () => slowHr.promise },
        reports: { en: async () => module({ title: "Reports" }), hr: async () => module({ title: "Izvještaji" }) },
      });
      await runtime.load(["tickets"]);

      const switching = runtime.setLocale("hr");
      await runtime.load(["reports"]); // a navigation during the switch
      slowHr.resolve(module({ title: "Tiketi" }));
      await switching;

      expect(i18n.global.t("reports.title")).toBe("Izvještaji");
    });

    it("rejects a locale the application does not support", async () => {
      const { runtime } = setup({});
      await expect(runtime.setLocale("de")).rejects.toThrow(/Unsupported locale "de"; this application supports en, hr, sl/);
    });

    it("a failing namespace does not block the switch; it falls back", async () => {
      const { runtime, i18n, failures } = setup({ tickets: { en: async () => module({ title: "Tickets" }), hr: async () => { throw new Error("404"); } } });
      await runtime.load(["tickets"]);

      await expect(runtime.setLocale("hr")).resolves.toBe(true);
      expect(failures).toHaveLength(1);
      expect(i18n.global.t("tickets.title")).toBe("Tickets");
    });
  });

  it("dispose drops every late answer", async () => {
    const gate = deferred<{ default: Record<string, unknown> }>();
    const { runtime, t, failures } = setup({ tickets: { en: () => gate.promise } });

    const loading = runtime.load(["tickets"]);
    runtime.dispose();
    gate.resolve(module({ title: "Tickets" }));
    await loading;

    expect(t("tickets.title")).toBe("tickets.title");
    expect(failures).toEqual([]);
    await expect(runtime.setLocale("en")).resolves.toBe(false);
  });
});
