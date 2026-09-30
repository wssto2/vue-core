import { afterEach, describe, expect, it } from "vitest";
import { BootstrapError, parseBootstrap, readBootstrap } from "./bootstrap";

const problems = (run: () => unknown): readonly string[] => {
  try {
    run();
  } catch (error) {
    if (error instanceof BootstrapError) return error.issues;
    throw error;
  }
  throw new Error("expected a BootstrapError");
};

describe("parseBootstrap", () => {
  it("reads the shared config, with defaults for the optional keys", () => {
    expect(parseBootstrap({ locale: "hr" })).toEqual({ locale: "hr", apiBase: "", appName: null, capabilities: [] });
    expect(
      parseBootstrap({ locale: "en", api_base: "/api/v1", app_name: "Helpdesk", capabilities: ["tickets", "sla"] }),
    ).toEqual({ locale: "en", apiBase: "/api/v1", appName: "Helpdesk", capabilities: ["tickets", "sla"] });
  });

  it("names every problem at once, with the key and what was found", () => {
    const issues = problems(() => parseBootstrap({ api_base: 5, app_name: true, capabilities: ["a", 1] }));
    expect(issues).toEqual([
      "locale: expected string, got nothing (missing)",
      "api_base: expected string, got number",
      "app_name: expected string, got boolean",
      "capabilities: expected array of strings, got array",
    ]);
  });

  it("rejects an empty locale and non-object documents", () => {
    expect(problems(() => parseBootstrap({ locale: "" }))).toEqual(["locale: must not be empty"]);
    expect(problems(() => parseBootstrap("x"))).toEqual(["expected a JSON object, got string"]);
    expect(problems(() => parseBootstrap(null))).toEqual(["expected a JSON object, got null"]);
    expect(problems(() => parseBootstrap([]))).toEqual(["expected a JSON object, got array"]);
  });

  it("puts the error message together from the issues", () => {
    expect(() => parseBootstrap({})).toThrow("Invalid bootstrap config: locale: expected string, got nothing (missing)");
  });

  it("merges an application section typed from what extend returns, and validates it in the same pass", () => {
    const config = parseBootstrap({ locale: "hr", country: "HR", vat_rate: 0, viewer: { id: 4 }, eurotax: false }, (fields) => ({
      country: fields.string("country"),
      vatRate: fields.number("vat_rate"), // 0 is a value; ARV's `if (clone.vat_rate)` skipped it
      eurotax: fields.boolean("eurotax", false),
      viewerId: fields.section("viewer").number("id"),
    }));
    expect(config).toEqual({
      locale: "hr", apiBase: "", appName: null, capabilities: [],
      country: "HR", vatRate: 0, eurotax: false, viewerId: 4,
    });
    const country: string = config.country;
    expect(country).toBe("HR");
  });

  it("reports application issues together with shared ones, nested ones by path", () => {
    const issues = problems(() =>
      parseBootstrap({ currency: 1, viewer: { id: "x" } }, (fields) => ({
        currency: fields.string("currency"),
        viewerId: fields.section("viewer").number("id"),
        missing: fields.section("absent").string("k"),
        locales: fields.raw("locales"),
      })),
    );
    expect(issues).toEqual([
      "locale: expected string, got nothing (missing)",
      "currency: expected string, got number",
      "viewer.id: expected number, got string",
      "absent: expected object, got undefined",
    ]);
  });

  it("lets the application validate a raw value itself and report with fail", () => {
    const issues = problems(() =>
      parseBootstrap({ locale: "hr", locales: "hr" }, (fields) => {
        const locales = fields.raw("locales");
        if (!Array.isArray(locales)) fields.fail("locales", "expected a list of locales");
        return {};
      }),
    );
    expect(issues).toEqual(["locales: expected a list of locales"]);
  });

  it("does not let the application section override the shared keys", () => {
    const config = parseBootstrap({ locale: "hr" }, () => ({ locale: "xx" }));
    expect(config.locale).toBe("hr");
  });

  it("has optional reads fall back only for an absent key, not for a wrong type", () => {
    expect(problems(() => parseBootstrap({ locale: "hr", n: "1" }, (fields) => ({ n: fields.number("n", 0) })))).toEqual([
      "n: expected number, got string",
    ]);
  });
});

describe("readBootstrap", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  const embed = (content: string, id = "app-state") => {
    document.body.innerHTML = `<script id="${id}" type="application/json">${content}</script>`;
  };

  it("reads the default element", () => {
    embed('{"locale":"sl","app_name":"X"}');
    expect(readBootstrap()).toMatchObject({ locale: "sl", appName: "X" });
  });

  it("reads another element by id or reference and extends", () => {
    embed('{"locale":"hr","n":2}', "other");
    expect(readBootstrap({ element: "other", extend: (fields) => ({ n: fields.number("n") }) }).n).toBe(2);
    expect(readBootstrap({ element: document.getElementById("other") as Element }).locale).toBe("hr");
  });

  it("explains a missing element, an empty one and broken JSON", () => {
    expect(() => readBootstrap()).toThrow(/no #app-state element/);
    embed("   ");
    expect(() => readBootstrap()).toThrow(/#app-state has no content/);
    embed("{oops");
    expect(() => readBootstrap()).toThrow(/not valid JSON/);
  });

  it("reports validation problems of the embedded config", () => {
    embed('{"country":1}');
    expect(() => readBootstrap()).toThrow(BootstrapError);
  });
});
