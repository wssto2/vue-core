import { describe, expect, it } from "vitest";
import { createTestApp, withSetup } from "../testing";
import { applicationKey, type ApplicationEnvironment } from "./environment";
import { useLanguages } from "./languages";

describe("useLanguages", () => {
  it("offers the application's locales as options, each named in itself", () => {
    const environment = { locales: ["en", "hr"] } as unknown as ApplicationEnvironment;
    const app = createTestApp({ plugins: [{ install: (vue) => vue.provide(applicationKey, environment) }] });
    const { result } = withSetup(() => useLanguages(), app);
    expect(result.value).toEqual([{ value: "en", label: "English" }, { value: "hr", label: "Hrvatski" }]);
  });
});
