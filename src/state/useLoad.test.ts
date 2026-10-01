import { describe, expect, it } from "vitest";
import { defineComponent, effectScope, h, nextTick, ref, type EffectScope } from "vue";
import { render } from "@testing-library/vue";
import { ApiError } from "../client";
import { deferred } from "../platform/testing";
import { createTestI18n } from "../testing/i18n";
import { useLoad, type Load, type LoadContext, type LoadOptions } from "./useLoad";

const i18n = createTestI18n({ locale: "en" });

/** Runs `useLoad` inside a mounted component (it reads the i18n composer) and returns what it gave. */
function mount<T>(load: (context: LoadContext) => Promise<T>, options?: LoadOptions) {
  let result!: Load<T>;
  const view = render(defineComponent({ setup() { result = useLoad(load, options); return () => h("p"); } }), { global: { plugins: [i18n] } });
  return { ...view, load: result };
}
const status = (load: Load<unknown>) => load.state.value.status;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("useLoad", () => {
  it("loads at once and gives the AsyncState", async () => {
    const first = deferred<string[]>();
    const { load } = mount(() => first.promise);
    expect(load.state.value).toEqual({ status: "loading" });
    first.resolve(["a"]);
    await settle();
    expect(load.state.value).toEqual({ status: "loaded", value: ["a"] });
    expect(load.data.value).toEqual(["a"]);
  });

  it("does not load before reload() when immediate is false", async () => {
    let calls = 0;
    const { load } = mount(async () => ++calls, { immediate: false });
    expect(calls).toBe(0);
    await load.reload();
    expect(load.data.value).toBe(1);
  });

  it("keeps the value while reloading, and shows it stale when the reload fails", async () => {
    const answers = [deferred<string>(), deferred<string>(), deferred<string>()];
    let call = 0;
    const { load } = mount(() => answers[call++]!.promise);
    answers[0]!.resolve("one");
    await settle();
    const again = load.reload();
    expect(load.state.value).toEqual({ status: "refreshing", value: "one" });
    answers[1]!.reject(new ApiError({ kind: "network", message: "offline" }));
    await again;
    expect(load.state.value).toEqual({ status: "stale", value: "one", error: "The server could not be reached. Check your connection and try again." });
  });

  it("is failed with the generic sentence when there was nothing to keep", async () => {
    const { load } = mount(async () => { throw new Error("boom"); });
    await load.reload();
    expect(load.state.value).toEqual({ status: "failed", error: "An error occurred while loading data. Please try again." });
  });

  it("the latest load wins and an older one is aborted and dropped", async () => {
    const answers = [deferred<string>(), deferred<string>()];
    const signals: AbortSignal[] = [];
    let call = 0;
    const { load } = mount(({ signal }) => { signals.push(signal); return answers[call++]!.promise; }, { immediate: false });
    const older = load.reload();
    const newer = load.reload();
    expect(signals[0]!.aborted).toBe(true);
    answers[1]!.resolve("new");
    await newer;
    answers[0]!.resolve("old");
    await older;
    expect(load.data.value).toBe("new");
  });

  it("an older failure cannot replace a newer value", async () => {
    const answers = [deferred<string>(), deferred<string>()];
    let call = 0;
    const { load } = mount(() => answers[call++]!.promise, { immediate: false });
    const older = load.reload();
    const newer = load.reload();
    answers[1]!.resolve("new");
    await newer;
    answers[0]!.reject(new Error("late"));
    await older;
    expect(load.state.value).toEqual({ status: "loaded", value: "new" });
  });

  it("update() counts as the latest result: a load that started before it is dropped", async () => {
    const slow = deferred<string>();
    const { load } = mount(() => slow.promise, { immediate: false });
    const reading = load.reload();
    load.update("saved");
    slow.resolve("older server state");
    await reading;
    expect(load.state.value).toEqual({ status: "loaded", value: "saved" });
  });

  it("starts over from nothing when the watch source changes, and the old answer is dropped", async () => {
    const id = ref(1);
    const answers = new Map<number, ReturnType<typeof deferred<string>>>([[1, deferred()], [2, deferred()]]);
    const { load } = mount(() => answers.get(id.value)!.promise, { watch: id });
    answers.get(1)!.resolve("one");
    await settle();
    expect(load.data.value).toBe("one");
    id.value = 2;
    await nextTick();
    expect(load.state.value).toEqual({ status: "loading" });
    answers.get(2)!.resolve("two");
    await settle();
    expect(load.data.value).toBe("two");
  });

  it("ignores what arrives after the scope ended", async () => {
    const late = deferred<string>();
    let scope!: EffectScope;
    let signal!: AbortSignal;
    let result!: Load<string>;
    const view = render(defineComponent({
      setup() {
        scope = effectScope();
        result = scope.run(() => useLoad(({ signal: s }) => { signal = s; return late.promise; }))!;
        return () => h("p");
      },
    }), { global: { plugins: [i18n] } });
    scope.stop();
    expect(signal.aborted).toBe(true);
    late.resolve("late");
    await settle();
    expect(status(result)).toBe("loading");
    view.unmount();
  });
});
