import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestApp, withSetup } from "../testing";
import BackgroundTaskCapsule from "./BackgroundTaskCapsule.vue";
import { MissingContextError } from "../platform/context";
import { createBackgroundTasks, installBackgroundTasks, useBackgroundTasks, type BackgroundTaskSpec } from "./backgroundTasks";

const spec: BackgroundTaskSpec = {
  id: "quote:42",
  title: "Quote · Golf",
  detail: "Calculating…",
  doneTitle: "The quote is ready",
  failedTitle: "The quote failed",
  route: "/quotes/42",
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("createBackgroundTasks", () => {
  it("runs the work, keeps the outcome and stays until someone takes note", async () => {
    const tasks = createBackgroundTasks();
    let finish: (value: number) => void = () => {};
    const running = tasks.run(spec, () => new Promise<number>((resolve) => (finish = resolve)), (price) => `${price} €`);

    expect(tasks.isRunning(spec.id)).toBe(true);
    expect(tasks.unwatched.value?.id).toBe(spec.id);

    finish(12400);
    await expect(running).resolves.toBe(12400);
    expect(tasks.find(spec.id)).toMatchObject({ status: "done", outcome: "12400 €" });

    tasks.dismiss(spec.id);
    expect(tasks.find(spec.id)).toBeUndefined();
  });

  it("gives no capsule for a task a page shows in place, until the page leaves", () => {
    const tasks = createBackgroundTasks();
    void tasks.run(spec, () => new Promise(() => {}));
    const unwatch = tasks.watchTask(spec.id);
    expect(tasks.unwatched.value).toBeNull();
    unwatch();
    expect(tasks.unwatched.value?.id).toBe(spec.id);
  });

  it("marks a failure and passes the error on", async () => {
    const tasks = createBackgroundTasks();
    await expect(tasks.run(spec, () => Promise.reject(new Error("No answer")))).rejects.toThrow("No answer");
    expect(tasks.find(spec.id)).toMatchObject({ status: "failed", outcome: "No answer" });
  });

  it("replaces a task of the same subject and follows the latest unwatched one", () => {
    const tasks = createBackgroundTasks();
    void tasks.run(spec, () => new Promise(() => {}));
    void tasks.run({ ...spec, id: "quote:43" }, () => new Promise(() => {}));
    void tasks.run(spec, () => new Promise(() => {}));
    expect(tasks.tasks.value.map((task) => task.id)).toEqual(["quote:43", "quote:42"]);
    expect(tasks.unwatched.value?.id).toBe("quote:42");
  });
});

describe("installBackgroundTasks", () => {
  it("provides the tasks to the components below and says what is missing without it", () => {
    const tasks = createBackgroundTasks();
    const app = createTestApp({ plugins: [{ install: (target) => void installBackgroundTasks(target, tasks) }] });
    expect(withSetup(() => useBackgroundTasks(), app).result).toBe(tasks);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => withSetup(() => useBackgroundTasks(), createTestApp())).toThrow(MissingContextError);
  });
});

describe("BackgroundTaskCapsule", () => {
  function mount(tasks = createBackgroundTasks()) {
    const app = createTestApp({ plugins: [{ install: (target) => void installBackgroundTasks(target, tasks) }] });
    render(BackgroundTaskCapsule, { props: { hideAfterMs: 1000 }, global: { plugins: [...app.plugins], stubs: { transition: false } } });
    return { tasks, app };
  }

  it("follows a running task with its seconds, then offers the way back and goes by itself", async () => {
    vi.useFakeTimers();
    const { tasks, app } = mount();
    expect(screen.queryByRole("status")).toBeNull();

    let finish: () => void = () => {};
    const done = tasks.run(spec, () => new Promise<void>((resolve) => (finish = resolve)), () => "Total 12 €");
    await vi.advanceTimersByTimeAsync(3000);
    expect(screen.getByText("Quote · Golf")).toBeTruthy();
    expect(screen.getByText("Calculating…")).toBeTruthy();
    expect(screen.getByText("3 s")).toBeTruthy();

    finish();
    await done;
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByText("The quote is ready")).toBeTruthy();
    expect(screen.getByText("Total 12 €")).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await vi.advanceTimersByTimeAsync(0);
    expect(app.router.currentRoute.value.fullPath).toBe("/quotes/42");
    expect(tasks.find(spec.id)).toBeUndefined();
  });

  it("says a failure, keeps it for hideAfterMs and can be closed", async () => {
    vi.useFakeTimers();
    const { tasks } = mount();
    await tasks.run(spec, () => Promise.reject(new Error("No answer"))).catch(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByText("The quote failed")).toBeTruthy();
    expect(screen.getByText("No answer")).toBeTruthy();

    await vi.advanceTimersByTimeAsync(1000);
    expect(tasks.find(spec.id)).toBeUndefined();

    await tasks.run({ ...spec, id: "other" }, () => Promise.reject(new Error("x"))).catch(() => {});
    await vi.advanceTimersByTimeAsync(0);
    await fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(tasks.find("other")).toBeUndefined();
  });

  it("shows nothing for a task a page shows in place", async () => {
    const { tasks } = mount();
    tasks.watchTask(spec.id);
    void tasks.run(spec, () => new Promise(() => {}));
    await Promise.resolve();
    expect(screen.queryByText("Quote · Golf")).toBeNull();
  });
});
