// `vue-core feature <a/b> --entity <Name>`: scaffolds a CRUD feature folder from a template folder.
// A template is a folder of `*.tpl` files in which `__FEATURE_*__` is replaced (see buildFeatureContext);
// `generator.template` points at the application's own, the default is bin/templates/feature-crud.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_TEMPLATE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "templates", "feature-crud");

export function parseFeatureArgs(argv) {
  let featurePath = "";
  let entityName = "";

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!argument) {
      continue;
    }

    if (!argument.startsWith("--") && !featurePath) {
      featurePath = argument;
      continue;
    }

    if (argument === "--feature") {
      featurePath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (argument === "--entity") {
      entityName = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!featurePath || !entityName) {
    throw new Error("Usage: vue-core feature administration/example-reports --entity ExampleReport");
  }

  return { featurePath, entityName };
}

/** `featuresDirectory` is where the feature folder goes (absolute); the placeholders are the template's vocabulary. */
export function buildFeatureContext({ featurePath, entityName }, featuresDirectory = path.resolve("features")) {
  const normalizedFeaturePath = normalizeFeaturePath(featurePath);
  const featureSegments = normalizedFeaturePath.split("/");
  const featureSlug = featureSegments.at(-1);

  if (!featureSlug) {
    throw new Error(`Invalid feature path: ${featurePath}`);
  }

  const routeGroup = featureSlug.toLowerCase().replace(/[^a-z0-9]/g, "");
  const routeName = featureSegments.map(toSnakeCase).join(".");
  const routePath = `/${normalizedFeaturePath}`;
  const i18nModule = featureSegments.map(toSnakeCase).join(".");

  return {
    featurePath: normalizedFeaturePath,
    featureDirectory: path.join(featuresDirectory, normalizedFeaturePath),
    entityName,
    FEATURE_PATH: normalizedFeaturePath,
    FEATURE_ENTITY: entityName,
    FEATURE_TITLE: splitPascalCase(entityName),
    FEATURE_API_CLIENT: `${toCamelCase(featureSlug)}Api`,
    FEATURE_LIST: `${toCamelCase(entityName)}List`,
    // The route table ts:generate-routes writes for the Go feature (route.Group(<slug>, ...)).
    FEATURE_ROUTE_TABLE: `${routeGroup}Routes`,
    FEATURE_ROUTE_MODULE: routeGroup,
    FEATURE_FORM_SCHEMA: `${entityName}FormSchema`,
    FEATURE_FORM_TYPE: `${entityName}Form`,
    FEATURE_META_TYPE: `${entityName}Meta`,
    FEATURE_OPTIONS_TYPE: `${entityName}Options`,
    FEATURE_ROUTE_NAME: `${routeName}.index`,
    FEATURE_ROUTE_PATH: routePath,
    FEATURE_I18N_MODULE: i18nModule,
  };
}

export function generateFeatureFiles(context, templateDirectory = DEFAULT_TEMPLATE_DIR) {
  return listTemplateFiles(templateDirectory).map((relativeTemplatePath) => {
    const templatePath = path.join(templateDirectory, relativeTemplatePath);
    const templateContent = readFileSync(templatePath, "utf8");

    return {
      relativePath: renderTemplate(relativeTemplatePath.replace(/\.tpl$/, ""), context), // a file may be named after the entity
      content: renderTemplate(templateContent, context),
    };
  });
}

function listTemplateFiles(directoryPath, prefix = "") {
  return readdirSync(directoryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = prefix ? path.join(prefix, entry.name) : entry.name;
      const absolutePath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        return listTemplateFiles(absolutePath, relativePath);
      }

      return [relativePath];
    })
    .sort();
}

function renderTemplate(template, context) {
  return Object.entries(context).reduce((result, [key, value]) => {
    if (typeof value !== "string") {
      return result;
    }

    return result.replaceAll(`__${key}__`, value);
  }, template);
}

function normalizeFeaturePath(featurePath) {
  return featurePath
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

function toCamelCase(value) {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((segment, index) => {
      if (index === 0) {
        return segment.charAt(0).toLowerCase() + segment.slice(1);
      }

      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join("");
}

function toSnakeCase(value) {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.toLowerCase())
    .join("_");
}

function splitPascalCase(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

/** generator.out is relative to the config's folder, generator.template likewise (the default is absolute). */
export default function run({ args, config, root, out, err }) {
  try {
    const context = buildFeatureContext(parseFeatureArgs(args), path.resolve(root, config.out));

    if (existsSync(context.featureDirectory)) {
      throw new Error(`Feature directory already exists: ${context.featureDirectory}`);
    }

    mkdirSync(path.join(context.featureDirectory, "components"), { recursive: true });

    for (const file of generateFeatureFiles(context, path.resolve(root, config.template))) {
      const outputPath = path.join(context.featureDirectory, file.relativePath);
      mkdirSync(path.dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, file.content, "utf8");
    }

    out(`Created feature scaffold at ${context.featureDirectory}`);
    return 0;
  } catch (error) {
    err(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
