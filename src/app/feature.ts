import type { Component, InjectionKey } from "vue";
import type { RouteRecordRaw } from "vue-router";
import type { MessageNamespace } from "../i18n";
import type { NavigationBinding } from "../router/navigation";
import type { Platform } from "../platform/platform";
import type { SessionUser } from "../platform/session";

/** A typed context value a feature provides to everything below the application root: see `provideContext`. */
export interface ContextProvision<T = unknown> {
  readonly key: InjectionKey<T>;
  readonly value: T;
}

/**
 * Provides `value` under a context key (`defineFeatureContext`) for the whole application, before the
 * router can start a navigation. The key carries the type: a value of the wrong type does not compile.
 */
export function provideContext<T>(key: InjectionKey<T>, value: T): ContextProvision<T> {
  return { key, value };
}

/**
 * The named places of the shell a feature can put a component into. The documented set; a custom
 * shell that offers more augments this interface (declaration merging, like `IconRegistry`).
 *
 * - `headerActions`: the actions of the top bar (a notification bell, a search button)
 * - `accountMenu`: entries of the signed-in user's menu
 * - `host`: components with no place of their own that must be mounted once (a command palette, a dialog host)
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- extended by augmentation, see the doc comment
export interface ShellSlots {}
interface DocumentedShellSlots {
  headerActions: true;
  accountMenu: true;
  host: true;
}
export type ShellSlot = keyof DocumentedShellSlots | keyof ShellSlots;

/** A component a feature adds to a place of the shell, without the shell's source knowing the feature. */
export interface ShellContribution {
  /** Unique in the application. */
  readonly id: string;
  readonly slot: ShellSlot;
  readonly component: Component;
  /** `authenticated` renders only while someone is signed in; `always` also on the login page. */
  readonly scope: "always" | "authenticated";
  /** Ascending within the slot; ties keep the order of the feature list. Default 0. */
  readonly order?: number;
  /** Message namespaces the component needs: loaded before it renders. */
  readonly messages?: readonly string[];
  /** A shell without this slot leaves it out instead of failing startup. */
  readonly optional?: boolean;
}

/** What an effect is given when it starts. */
export interface AppEffectContext {
  /** Aborted when the effect must end: the application is disposed, or (session effects) the session changed or ended. Ignore late results once it is. */
  readonly signal: AbortSignal;
  readonly platform: Platform;
  /** Reports a failure that does not stop the effect (to the application's `onError`). */
  report(error: unknown): void;
}

export interface SessionEffectContext extends AppEffectContext {
  /** Who is signed in for this run of the effect. */
  readonly user: SessionUser;
}

/** What a started effect returns to clean up: clear timers, remove listeners. Called once, after `signal` aborted. */
export type EffectStop = () => void;

/** Background behavior that runs once per mounted application. */
export interface AppEffect {
  readonly id: string;
  readonly scope: "app";
  start(context: AppEffectContext): EffectStop | void;
}

/** Background behavior of a signed-in session: started when one begins, restarted when the user or scope changes, stopped on sign-out. */
export interface SessionEffect {
  readonly id: string;
  readonly scope: "session";
  start(context: SessionEffectContext): EffectStop | void;
}

export type FeatureEffect = AppEffect | SessionEffect;

/** A feature named by its id or by its descriptor. */
export type FeatureReference = string | { readonly id: string };

export interface FeatureDefinition {
  /** Unique in the application; named in every error about the feature. */
  id: string;
  /** Ordinary Vue Router records, usually `defineRoutes(...).records`. The runtime marks them as this feature's. */
  routes?: readonly RouteRecordRaw[];
  /** Typed contexts the feature's components read, provided before the router starts. */
  context?: ContextProvision | readonly ContextProvision[];
  /** Message namespaces, loaded when a route of this feature is entered. */
  messages?: MessageNamespace | readonly MessageNamespace[];
  /** Which local route each backend navigation destination this feature serves opens. */
  navigation?: readonly NavigationBinding[];
  /** Components this feature puts into the shell. */
  contributions?: readonly ShellContribution[];
  /** Background behavior, started and stopped by the runtime. */
  effects?: readonly FeatureEffect[];
  /** Capabilities the backend must report (`platform.config.capabilities`); startup fails naming this feature when one is missing. */
  backend?: readonly string[];
  /** Features that must be installed too (for a shared integration); checked, never installed for you. */
  requires?: readonly FeatureReference[];
}

/** A feature as the application consumes it: every list present, nothing running. */
export interface Feature {
  readonly id: string;
  readonly routes: readonly RouteRecordRaw[];
  readonly contexts: readonly ContextProvision[];
  readonly messages: readonly MessageNamespace[];
  readonly navigation: readonly NavigationBinding[];
  readonly contributions: readonly ShellContribution[];
  readonly effects: readonly FeatureEffect[];
  readonly backend: readonly string[];
  readonly requires: readonly string[];
}

const defined = new WeakSet<object>();

/** Whether `value` came from `defineFeature`. */
export const isFeature = (value: unknown): value is Feature => typeof value === "object" && value !== null && defined.has(value);

const listOf = <T>(value: T | readonly T[] | undefined): readonly T[] =>
  value === undefined ? [] : Array.isArray(value) ? [...(value as readonly T[])] : [value as T];

/**
 * Declares a feature: everything the application installs for it in one value. Pure: nothing runs,
 * no request is made, no listener is added; `createApplication` installs it and validates the whole
 * composition (unique ids and route names, context keys, namespaces, destinations).
 *
 *   export const ticketsFeature = defineFeature({
 *     id: "tickets",
 *     routes: ticketRoutes.records,
 *     context: provideContext(TICKETS, { api }),
 *     messages: localeMessages("tickets", { en: () => import("./i18n/en.json") }),
 *     navigation: [{ destination: "tickets", to: ticketRoutes.index }],
 *   });
 */
export function defineFeature(definition: FeatureDefinition): Feature {
  if (typeof definition.id !== "string" || definition.id.trim() === "") throw new Error("defineFeature: `id` must be a non-empty string.");
  const feature: Feature = Object.freeze({
    id: definition.id,
    routes: listOf(definition.routes),
    contexts: listOf(definition.context),
    messages: listOf(definition.messages),
    navigation: listOf(definition.navigation),
    contributions: listOf(definition.contributions),
    effects: listOf(definition.effects),
    backend: listOf(definition.backend),
    requires: listOf(definition.requires).map((reference) => (typeof reference === "string" ? reference : reference.id)),
  });
  defined.add(feature);
  return feature;
}
