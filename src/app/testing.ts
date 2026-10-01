// Fixtures for this folder's tests; the declaration build excludes it.
import { defineComponent, h, type Component } from "vue";
import { createMemoryHistory } from "vue-router";
import { createPlatform, parseBootstrap, type Platform, type SessionAdapter, type SessionSnapshot } from "../platform";
import { createTestSession } from "../testing";
import { settle as settleRounds } from "../testing/async";
import type { ApplicationOptions } from "./application";
import type { Feature } from "./feature";

/** A page that renders `text`. */
export const page = (text: string): Component => defineComponent({ render: () => h("p", { "data-page": "" }, text) });

/** A backend the test steers: who is signed in, whether the server answers, when. */
export function fakeBackend(initial: SessionSnapshot | null = null, config: Record<string, unknown> = {}) {
  const backend = {
    snapshot: initial,
    failing: false,
    loads: 0,
    signOuts: 0,
    /** While set, a load waits for it. */
    gate: null as Promise<void> | null,
  };
  const adapter: SessionAdapter = {
    async load(signal) {
      backend.loads++;
      await backend.gate;
      if (signal.aborted) throw new DOMException("aborted", "AbortError");
      if (backend.failing) throw new Error("server down");
      return backend.snapshot;
    },
    async signOut() {
      backend.signOuts++;
    },
  };
  const platform: Platform = createPlatform({
    config: parseBootstrap({ locale: "en", app_name: "Test app", ...config }),
    session: adapter,
  });
  return { backend, platform };
}

/** A signed-in snapshot of user `id` holding these permissions at the organization. */
export const signedIn = (id: number, permissions: string[] = [], extra: Partial<SessionSnapshot> = {}): SessionSnapshot => ({ ...createTestSession({ user: { id }, permissions }), ...extra });

/** Options for `createApplication` over a memory history starting at `location`. */
export function options(platform: Platform, features: readonly Feature[], location = "/", extra: Partial<ApplicationOptions> = {}): ApplicationOptions {
  const history = createMemoryHistory();
  history.replace(location);
  return { platform, features, router: { history }, i18n: { missingWarn: false }, ...extra };
}

/** Lets promises and Vue's scheduler settle. */
export const settle = () => settleRounds(10);
