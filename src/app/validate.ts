import type { InjectionKey } from "vue";
import type { RouteRecordRaw } from "vue-router";
import type { MessageNamespace } from "../i18n";
import type { Platform } from "../platform/platform";
import type { Feature, ShellSlot } from "./feature";
import { isFeature } from "./feature";

/** One thing wrong with the composition, and who owns it. */
export interface CompositionIssue {
  /** `feature "tickets"`, or `application`. */
  readonly owner: string;
  readonly message: string;
}

/** Thrown by `createApplication` when the composition is invalid; `issues` lists every problem, each naming its owner. */
export class ApplicationError extends Error {
  readonly issues: readonly CompositionIssue[];

  constructor(issues: readonly CompositionIssue[]) {
    super(`The application composition is invalid:\n${issues.map((issue) => `  - [${issue.owner}] ${issue.message}`).join("\n")}`);
    this.name = "ApplicationError";
    this.issues = issues;
  }
}

export interface CompositionInput {
  features: readonly unknown[];
  platform: Platform;
  /** Namespaces the application (or its shell) owns itself. */
  messages: readonly MessageNamespace[];
  /** Keys the runtime provides: a feature may not provide them. */
  reservedContexts: readonly InjectionKey<never>[];
  supportedLocales: readonly string[];
  /** The slots the shell renders, when it says. */
  shellSlots: readonly ShellSlot[] | undefined;
}

const appOwner = "application";
const ownerOf = (feature: Feature) => `feature "${feature.id}"`;

function* walk(records: readonly RouteRecordRaw[], parent = ""): Generator<{ record: RouteRecordRaw; path: string }> {
  for (const record of records) {
    const path = record.path.startsWith("/") ? record.path : `${parent.replace(/\/$/, "")}/${record.path}`;
    yield { record, path };
    if (record.children) yield* walk(record.children, path);
  }
}

/**
 * Checks the whole composition at once, so one run shows every mistake: unique feature ids, route
 * names and paths, context keys, message namespaces and their locales, navigation bindings,
 * contribution ids and slots, effect ids, required backend capabilities and required features.
 * Returns the valid features (the rest are in the issues).
 */
export function validateComposition(input: CompositionInput): { features: readonly Feature[]; issues: CompositionIssue[] } {
  const issues: CompositionIssue[] = [];
  const report = (owner: string, message: string) => issues.push({ owner, message });

  const features: Feature[] = [];
  input.features.forEach((value, index) => {
    if (isFeature(value)) features.push(value);
    else report(appOwner, `features[${index}] was not created with defineFeature().`);
  });

  // ids
  const byId = new Map<string, Feature>();
  for (const feature of features) {
    if (byId.has(feature.id)) report(ownerOf(feature), `the feature id "${feature.id}" is used twice in the features list.`);
    else byId.set(feature.id, feature);
  }

  // requirements
  for (const feature of features) {
    for (const required of feature.requires) {
      if (!byId.has(required)) report(ownerOf(feature), `requires the feature "${required}", which is not in the features list.`);
    }
  }
  const visiting: string[] = [];
  const settled = new Set<string>();
  const visit = (feature: Feature): void => {
    if (settled.has(feature.id)) return;
    const cycleAt = visiting.indexOf(feature.id);
    if (cycleAt !== -1) {
      report(ownerOf(feature), `requirements form a cycle: ${[...visiting.slice(cycleAt), feature.id].join(" -> ")}.`);
      settled.add(feature.id);
      return;
    }
    visiting.push(feature.id);
    for (const required of feature.requires) {
      const next = byId.get(required);
      if (next) visit(next);
    }
    visiting.pop();
    settled.add(feature.id);
  };
  features.forEach(visit);

  // backend capabilities
  const capabilities = new Set(input.platform.config.capabilities);
  for (const feature of features) {
    for (const capability of feature.backend) {
      if (!capabilities.has(capability)) report(ownerOf(feature), `needs the backend capability "${capability}", which the server does not report.`);
    }
  }

  // routes
  const routeNames = new Map<string, Feature>();
  const topLevelPaths = new Map<string, Feature>();
  for (const feature of features) {
    for (const record of feature.routes) {
      const normalized = record.path.length > 1 ? record.path.replace(/\/$/, "") : record.path;
      const other = topLevelPaths.get(normalized);
      if (other) report(ownerOf(feature), `declares the path "${record.path}", which feature "${other.id}" declares too.`);
      else topLevelPaths.set(normalized, feature);
    }
    for (const { record } of walk(feature.routes)) {
      if (record.meta && "feature" in record.meta) report(ownerOf(feature), `the route "${String(record.name ?? record.path)}" sets meta.feature, which the runtime owns.`);
      if (typeof record.name !== "string") continue;
      const other = routeNames.get(record.name);
      if (other) report(ownerOf(feature), `declares the route name "${record.name}", which feature "${other.id}" declares too.`);
      else routeNames.set(record.name, feature);
    }
  }

  // contexts
  const reserved = new Set<symbol>(input.reservedContexts as readonly symbol[]);
  const contextOwners = new Map<symbol, Feature>();
  for (const feature of features) {
    for (const { key } of feature.contexts) {
      const label = (key as symbol).description ?? "a context";
      if (reserved.has(key as symbol)) report(ownerOf(feature), `provides the context "${label}", which the runtime provides itself.`);
      const other = contextOwners.get(key as symbol);
      if (other) report(ownerOf(feature), `provides the context "${label}", which feature "${other.id}" provides too.`);
      else contextOwners.set(key as symbol, feature);
    }
  }

  // message namespaces
  const namespaces = new Map<string, string>(); // namespace -> owner
  const declare = (owner: string, entries: readonly MessageNamespace[]) => {
    for (const entry of entries) {
      const other = namespaces.get(entry.namespace);
      if (other) report(owner, `declares the message namespace "${entry.namespace}", which ${other} declares too.`);
      else namespaces.set(entry.namespace, owner);
      for (const locale of Object.keys(entry.loaders)) {
        if (!input.supportedLocales.includes(locale)) report(owner, `the namespace "${entry.namespace}" has a loader for "${locale}", which is not a supported locale (${input.supportedLocales.join(", ")}).`);
      }
    }
  };
  for (const feature of features) declare(ownerOf(feature), feature.messages);
  declare(appOwner, input.messages);
  const knownNamespace = (namespace: string) => namespaces.has(namespace);
  for (const feature of features) {
    for (const { record } of walk(feature.routes)) {
      for (const namespace of record.meta?.messages ?? []) {
        if (!knownNamespace(namespace)) report(ownerOf(feature), `the route "${String(record.name ?? record.path)}" needs the message namespace "${namespace}", which nobody declares.`);
      }
    }
  }

  // contributions
  const contributionIds = new Map<string, Feature>();
  for (const feature of features) {
    for (const contribution of feature.contributions) {
      const other = contributionIds.get(contribution.id);
      if (other) report(ownerOf(feature), `declares the shell contribution "${contribution.id}", which feature "${other.id}" declares too.`);
      else contributionIds.set(contribution.id, feature);
      if (input.shellSlots && !contribution.optional && !input.shellSlots.includes(contribution.slot)) {
        report(ownerOf(feature), `contributes "${contribution.id}" to the slot "${contribution.slot}", which the shell does not render (it renders ${input.shellSlots.join(", ") || "none"}). Mark it optional to leave it out instead.`);
      }
      for (const namespace of contribution.messages ?? []) {
        if (!knownNamespace(namespace)) report(ownerOf(feature), `the contribution "${contribution.id}" needs the message namespace "${namespace}", which nobody declares.`);
      }
    }
  }

  // effects
  const effectIds = new Map<string, Feature>();
  for (const feature of features) {
    for (const effect of feature.effects) {
      const other = effectIds.get(effect.id);
      if (other) report(ownerOf(feature), `declares the effect "${effect.id}", which feature "${other.id}" declares too.`);
      else effectIds.set(effect.id, feature);
      const scope: string = effect.scope;
      if (scope !== "app" && scope !== "session") report(ownerOf(feature), `the effect "${effect.id}" has the scope "${scope}"; use "app" or "session".`);
    }
  }

  return { features, issues };
}
