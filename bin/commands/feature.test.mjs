import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "../cli.mjs";
import { buildFeatureContext, generateFeatureFiles, parseFeatureArgs } from "./feature.mjs";

const cache = join(process.cwd(), "node_modules", ".cache", "feature");
mkdirSync(cache, { recursive: true });
const folder = () => mkdtempSync(join(cache, "case-"));

const run = async (argv, cwd) => {
  const out = [];
  const err = [];
  const code = await main(argv, { cwd, out: (text) => out.push(text), err: (text) => err.push(text) });
  return { code, out: out.join("\n"), err: err.join("\n") };
};

const files = (featurePath, entityName) =>
  Object.fromEntries(generateFeatureFiles(buildFeatureContext({ featurePath, entityName })).map((file) => [file.relativePath, file.content]));

describe("feature generator", () => {
  it("parses a path and an entity, in either flag form", () => {
    expect(parseFeatureArgs(["a/b", "--entity", "X"])).toEqual({ featurePath: "a/b", entityName: "X" });
    expect(parseFeatureArgs(["--feature", "a/b", "--entity", "X"])).toEqual({ featurePath: "a/b", entityName: "X" });
    expect(() => parseFeatureArgs(["a/b"])).toThrow("Usage: vue-core feature");
    expect(() => parseFeatureArgs(["a/b", "--entity", "X", "--nope"])).toThrow("Unknown argument: --nope");
  });

  it("derives the names the template is written in", () => {
    const context = buildFeatureContext({ featurePath: "administration/example-reports", entityName: "ExampleReport" });
    expect(context).toMatchObject({
      featurePath: "administration/example-reports",
      FEATURE_TITLE: "Example Report",
      FEATURE_API_CLIENT: "exampleReportsApi",
      FEATURE_LIST: "exampleReportList",
      FEATURE_ROUTE_TABLE: "examplereportsRoutes",
      FEATURE_ROUTE_MODULE: "examplereports",
      FEATURE_FORM_SCHEMA: "ExampleReportFormSchema",
      FEATURE_ROUTE_NAME: "administration.example_reports.index",
      FEATURE_ROUTE_PATH: "/administration/example-reports",
      FEATURE_I18N_MODULE: "administration.example_reports",
    });
  });

  // go-core's ts:generate-routes names the table <slug lowercased, non-alphanumerics dropped>Routes and the folder by the slug.
  it("derives the route table and module go-core generates (test-data/go-core/tickets)", () => {
    const context = buildFeatureContext({ featurePath: "helpdesk/tickets", entityName: "Ticket" });
    expect(readFileSync("test-data/go-core/tickets/routes.ts", "utf8")).toContain(`export const ${context.FEATURE_ROUTE_TABLE} = {`);
    expect(context.FEATURE_ROUTE_MODULE).toBe("tickets");
    expect(buildFeatureContext({ featurePath: "x/Service-Orders_2", entityName: "O" })).toMatchObject({ FEATURE_ROUTE_TABLE: "serviceorders2Routes", FEATURE_ROUTE_MODULE: "serviceorders2" });
  });

  it("scaffolds a list on vue-core's collection, with the modal it opens", () => {
    const generated = files("administration/example-reports", "ExampleReport");
    expect(Object.keys(generated)).toEqual([
      "api.ts",
      "components/ExampleReportModal.vue",
      "form.ts",
      "index.ts",
      "routes.ts",
      "tests/scaffold.test.ts",
      "types.ts",
      "views/Index.vue",
    ]);
    expect(generated["api.ts"]).toContain('import { examplereportsRoutes } from "@/generated/routes/examplereports/routes";');
    expect(generated["index.ts"]).toContain("export { exampleReportsApi, exampleReportList }");
    expect(generated["routes.ts"]).toContain('"administration.example_reports.index"');
    const view = generated["views/Index.vue"];
    expect(view).toContain("t('administration.example_reports.title')");
    expect(view).toContain("satisfies CollectionColumns<ExampleReport, ExampleReportSort>");
    expect(view).toMatch(/\bmobile:\s*"primary"/);
    expect(view).toContain('import ExampleReportModal from "../components/ExampleReportModal.vue"');
    // the default template reaches vue-core by its subpaths and the generated route table, nothing else of an application
    const imports = Object.values(generated).flatMap((content) => [...content.matchAll(/from "([^"]+)"/g)].map((match) => match[1]));
    expect(imports.filter((path) => !path.startsWith(".") && !path.startsWith("@wssto2/vue-core/") && !["vue", "vue-i18n", "vitest"].includes(path))).toEqual(
      expect.arrayContaining(["@/generated/routes/examplereports/routes"]),
    );
    expect(imports.filter((path) => path.startsWith("@/") && !path.startsWith("@/generated/") && !path.startsWith("@/features/"))).toEqual([]);
  });

  it("the committed sample in test-data/feature is what the default template makes (it is typechecked by typecheck:fixtures)", () => {
    for (const [relativePath, content] of Object.entries(files("helpdesk/tickets", "Ticket"))) {
      expect(readFileSync(join("test-data/feature/features/helpdesk/tickets", relativePath), "utf8"), relativePath).toBe(content);
    }
  });
});

describe("vue-core feature", () => {
  it("writes the folder under generator.out, from the config's folder, and refuses to overwrite it", async () => {
    const dir = folder();
    writeFileSync(join(dir, "vue-core.config.mjs"), 'export default { generator: { out: "src/features" } };');
    const nested = join(dir, "sub");
    mkdirSync(nested);
    const first = await run(["feature", "helpdesk/tickets", "--entity", "Ticket"], nested);
    expect(first.code).toBe(0);
    expect(first.out).toBe(`Created feature scaffold at ${join(dir, "src/features/helpdesk/tickets")}`);
    expect(existsSync(join(dir, "src/features/helpdesk/tickets/components/TicketModal.vue"))).toBe(true);
    const second = await run(["feature", "--feature", "helpdesk/tickets", "--entity", "Ticket"], nested);
    expect(second.code).toBe(1);
    expect(second.err).toContain("Feature directory already exists");
  });

  it("uses the application's template folder", async () => {
    const dir = folder();
    mkdirSync(join(dir, "tpl"));
    writeFileSync(join(dir, "tpl/hello.txt.tpl"), "__FEATURE_ENTITY__ in __FEATURE_PATH__");
    writeFileSync(join(dir, "vue-core.config.mjs"), 'export default { generator: { template: "tpl" } };');
    expect((await run(["feature", "a/b", "--entity", "Thing"], dir)).code).toBe(0);
    expect(readFileSync(join(dir, "features/a/b/hello.txt"), "utf8")).toBe("Thing in a/b");
  });

  it("without an entity prints the usage and exits 1", async () => {
    const { code, err } = await run(["feature", "a/b"], folder());
    expect(code).toBe(1);
    expect(err).toBe("Usage: vue-core feature administration/example-reports --entity ExampleReport");
  });
});
