import { computed, ref, type App, type ComputedRef, type Ref } from "vue";
import type { RouteLocationRaw } from "vue-router";
import { defineFeatureContext } from "../platform/context";

/**
 * Work that outlives the page it started on (UI decision D23, MOTION_PLAN M2): a slow request the
 * user may walk away from. The request is owned here, not by the page, so leaving the page neither
 * loses its answer nor hides that it is running: the page that shows the task in place `watchTask`s
 * it, and while nobody does, the `BackgroundTaskCapsule` follows it and, when it ends, says so with
 * a way back (`route`).
 *
 *   installBackgroundTasks(app);                                   // once, in the composition root
 *   const tasks = useBackgroundTasks();                           // in setup
 *   const quote = await tasks.run(
 *     { id: `quote:${id}`, title: "Quote · Golf", detail: "Calculating…", doneTitle: "The quote is ready", failedTitle: "The quote failed", route: { name: "quote", params: { id } } },
 *     () => api.quote(id),
 *     (result) => `${result.total} €`,
 *   );
 */
export type BackgroundTaskStatus = "running" | "done" | "failed";

export type BackgroundTask = {
  /** Stable per subject, e.g. "quote:42": one task per subject at a time (a second `run` replaces the first). */
  id: string;
  /** What it is, e.g. "Quote · VW Golf". */
  title: string;
  /** What it is doing, while running. */
  detail: string;
  /** Where the result is. */
  route: RouteLocationRaw;
  /** The capsule's words when it ends. */
  doneTitle: string;
  failedTitle: string;
  /** `Date.now()` when it started. */
  startedAt: number;
  status: BackgroundTaskStatus;
  /** A line about the outcome ("12,400 €", or the error's message). */
  outcome?: string;
};

export type BackgroundTaskSpec = Omit<BackgroundTask, "startedAt" | "status" | "outcome">;

export type BackgroundTasks = {
  readonly tasks: Readonly<Ref<readonly BackgroundTask[]>>;
  find(id: string): BackgroundTask | undefined;
  isRunning(id: string): boolean;
  /**
   * Runs `work` as the task `spec.id` and resolves with its result (rejects with its error).
   * `outcome` turns the result into the capsule's line.
   */
  run<T>(spec: BackgroundTaskSpec, work: () => Promise<T>, outcome?: (result: T) => string | undefined): Promise<T>;
  /** A page shows this task in place: no capsule for it while the page is there. Returns the stop function. */
  watchTask(id: string): () => void;
  /** Takes the task off: a finished one stays until someone has (the page that shows it, or the capsule). */
  dismiss(id: string): void;
  /** The task the capsule follows: the latest one no page shows. */
  readonly unwatched: ComputedRef<BackgroundTask | null>;
};

/** A set of background tasks of one application. Use `installBackgroundTasks` in an application; this is for tests and for a subtree. */
export function createBackgroundTasks(): BackgroundTasks {
  const tasks = ref<BackgroundTask[]>([]);
  const watchers = ref<Record<string, number>>({});

  const find = (id: string) => tasks.value.find((task) => task.id === id);

  function update(id: string, patch: Partial<BackgroundTask>) {
    tasks.value = tasks.value.map((task) => (task.id === id ? { ...task, ...patch } : task));
  }

  async function run<T>(spec: BackgroundTaskSpec, work: () => Promise<T>, outcome?: (result: T) => string | undefined): Promise<T> {
    tasks.value = [...tasks.value.filter((item) => item.id !== spec.id), { ...spec, startedAt: Date.now(), status: "running" }];
    try {
      const result = await work();
      update(spec.id, { status: "done", outcome: outcome?.(result) });
      return result;
    } catch (error) {
      update(spec.id, { status: "failed", outcome: error instanceof Error ? error.message : undefined });
      throw error;
    }
  }

  function watchTask(id: string): () => void {
    watchers.value = { ...watchers.value, [id]: (watchers.value[id] ?? 0) + 1 };
    return () => {
      watchers.value = { ...watchers.value, [id]: Math.max(0, (watchers.value[id] ?? 1) - 1) };
    };
  }

  return {
    tasks,
    find,
    isRunning: (id) => find(id)?.status === "running",
    run,
    watchTask,
    dismiss: (id) => { tasks.value = tasks.value.filter((task) => task.id !== id); },
    unwatched: computed(() => [...tasks.value].reverse().find((task) => !(watchers.value[task.id] ?? 0)) ?? null),
  };
}

export const [backgroundTasksKey, useBackgroundTasks] = defineFeatureContext<BackgroundTasks>("vue-core.backgroundTasks");

/** Installs the background tasks of an application (a new set unless one is given) and returns them, for code outside components. */
export function installBackgroundTasks(app: App, tasks: BackgroundTasks = createBackgroundTasks()): BackgroundTasks {
  app.provide(backgroundTasksKey, tasks);
  return tasks;
}
