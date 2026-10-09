import { render } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { ApiError, type ApiErrorInit } from "../client";
import { createTestI18n } from "../testing/i18n";
import { appErrorDescriberKey, describeErrorWith, useDescribeError } from "./describeError";

const failure = (init: Partial<ApiErrorInit> & Pick<ApiErrorInit, "kind">) => new ApiError({ message: "log text", ...init });

function describer(locale: "en" | "hr" = "en", app: Record<string, unknown> = {}) {
  const i18n = createTestI18n({ locale });
  i18n.global.mergeLocaleMessage(locale, app);
  return describeErrorWith({ t: (key, params) => i18n.global.t(key, params ?? {}) as string, te: (key) => i18n.global.te(key) });
}

describe("describeError", () => {
  it("translates a go-core code with its params, the app's text before the library's", () => {
    const describe = describer("en", { errors: { iam: { locked: "Locked until {until}." } }, core: { errors: { "iam.locked": "library" } } });
    expect(describe(failure({ kind: "rejected", status: 403, code: "iam.locked", params: { until: "noon" } }))).toBe("Locked until noon.");
    expect(describer("en", { core: { errors: { custom: { code: "from core" } } } })(failure({ kind: "rejected", code: "custom.code" }))).toBe("from core");
  });

  it("shows the server's sentence for a code it cannot translate, not the status text", () => {
    expect(describer()(failure({ kind: "forbidden", status: 403, code: "x.unknown", message: "Prevedeno" }))).toBe("Prevedeno");
  });

  it.each([
    ["unauthorized", 401, "You are not signed in. Please sign in."],
    ["forbidden", 403, "You are not authorized to perform this action."],
    ["notFound", 404, "The record could not be found."],
    ["conflict", 409, "The record changed or already exists. Reload and try again."],
    ["network", null, "The server could not be reached. Check your connection and try again."],
    ["aborted", null, "The request was cancelled."],
    ["rejected", 429, "Too many requests in a short time. Wait a minute and try again."],
  ] as const)("says a sentence for %s", (kind, status, text) => {
    expect(describer()(failure({ kind, status }), { fallback: "mine" })).toBe(text);
  });

  it("asks to check the marked fields for a validation answer with fields", () => {
    expect(describer()(failure({ kind: "validation", status: 422, fields: { name: ["required"] } }), { fallback: "mine" })).toBe("Check the marked fields.");
    expect(describer("hr")(failure({ kind: "validation", status: 422, fields: { name: ["x"] } }))).toBe("Provjerite označena polja.");
  });

  it("uses the caller's fallback for server faults and other failures, else a general sentence", () => {
    expect(describer()(failure({ kind: "server", status: 500 }), { fallback: "Could not save." })).toBe("Could not save.");
    expect(describer()(failure({ kind: "malformed", status: 200 }))).toBe("An unexpected error occurred. Please try again.");
    expect(describer()(new Error("boom"), { fallback: "Could not save." })).toBe("Could not save.");
    expect(describer()("nothing")).toBe("An unexpected error occurred. Please try again.");
  });

  it("gives the server's text for another 4xx unless the caller has a fallback", () => {
    const refused = failure({ kind: "rejected", status: 400, message: "Business rule says no" });
    expect(describer()(refused)).toBe("Business rule says no");
    expect(describer()(refused, { fallback: "Could not save." })).toBe("Could not save.");
  });
});

describe("useDescribeError", () => {
  it("reads the composer of the app, in its language", () => {
    const view = render(defineComponent({ setup: () => { const describe = useDescribeError(); return () => h("p", describe(failure({ kind: "forbidden", status: 403 }))); } }), {
      global: { plugins: [createTestI18n({ locale: "hr" })] },
    });
    expect(view.getByText("Nemate ovlasti za ovu radnju.")).toBeTruthy();
  });

  it("useDescribeError asks the application's describer first, and the library for what it leaves", () => {
    let describe!: ReturnType<typeof useDescribeError>;
    const own = (error: unknown) => (error instanceof TypeError ? "Our own sentence" : undefined);
    render(defineComponent({ setup() { describe = useDescribeError(); return () => h("p"); } }), {
      global: { plugins: [createTestI18n({ locale: "en" })], provide: { [appErrorDescriberKey as symbol]: own } },
    });
    expect(describe(new TypeError("x"))).toBe("Our own sentence");
    expect(describe(failure({ kind: "forbidden", status: 403 }))).toBe("You are not authorized to perform this action.");
  });
});
