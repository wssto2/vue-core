import { hasInjectionContext, inject, type InjectionKey } from "vue";

/** Thrown by a context lookup when nothing provided the context. The message names it and says how to provide it. */
export class MissingContextError extends Error {
  readonly contextName: string;

  constructor(contextName: string, reason: "outside-setup" | "not-provided") {
    super(
      reason === "outside-setup"
        ? `The context "${contextName}" can only be read while a component is being set up (in setup(), <script setup> or a composable called from them).`
        : `The context "${contextName}" was not provided. Install it once with app.provide(key, value) in the composition root ` +
            `(or provide(key, value) in an ancestor component), before anything that reads it is mounted.`,
    );
    this.name = "MissingContextError";
    this.contextName = contextName;
  }
}

const absent = Symbol("absent");

/**
 * A typed context, the library's "environment": a Vue injection key plus a lookup that fails loudly.
 *
 * ```ts
 * export const [TICKETS, useTickets] = defineFeatureContext<TicketsDependencies>("helpdesk.tickets");
 * app.provide(TICKETS, dependencies); // once, in the composition root
 * const { api } = useTickets();       // in any component below; throws MissingContextError if absent
 * ```
 *
 * Providing again in an ancestor component overrides the value for that subtree, exactly like a
 * SwiftUI environment. `name` labels errors; the returned key carries the identity, so two contexts
 * with the same name never collide.
 */
export function defineFeatureContext<T>(name: string): readonly [key: InjectionKey<T>, use: () => T] {
  const key: InjectionKey<T> = Symbol(name);
  const use = (): T => {
    if (!hasInjectionContext()) throw new MissingContextError(name, "outside-setup");
    const value = inject<T | typeof absent>(key, absent);
    if (value === absent) throw new MissingContextError(name, "not-provided");
    return value;
  };
  return [key, use];
}
