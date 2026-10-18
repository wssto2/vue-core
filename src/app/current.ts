import type { Application } from "./application";

// The one application of this page, for code that runs outside setup (an api.ts, a router guard). A page runs one application; the
// newest `createApplication` wins, so a test that makes several still reads the one it made last.
let current: Application | null = null;

/** Called by `createApplication`; the returned function unbinds, and only if this application is still the current one. */
export function bindApplication(application: Application): () => void {
  current = application;
  return () => {
    if (current === application) current = null;
  };
}

/**
 * The application `createApplication` made, for code that runs outside setup: an `api.ts` reading `currentApplication().platform.http`, a router
 * guard, a store. Inside a component use `useApplication()` and the injected services; read it when the code runs, not at module load
 * (a module is evaluated before `main.ts` creates the application).
 *
 * Throws before one exists. In a unit test make one first: `createTestApplication()` from `@wssto2/vue-core/testing`, and `dispose()` it after.
 */
export function currentApplication(): Application {
  if (!current) {
    throw new Error(
      "There is no application yet: currentApplication() returns the one createApplication() made. Call it when the code runs (not while the module loads), after main.ts created the application; in a unit test call createTestApplication() from @wssto2/vue-core/testing first and dispose() it afterwards.",
    );
  }
  return current;
}
