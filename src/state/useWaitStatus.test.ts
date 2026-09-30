import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { useWaitStatus } from "./useWaitStatus";

// A wait shows nothing for 0.3 s, then counts, and says when it is slow.
describe("useWaitStatus", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows after 0.3 s, counts whole seconds and turns slow at its threshold", async () => {
    const busy = ref(false);
    const scope = effectScope();
    const wait = scope.run(() => useWaitStatus(busy, { slowAfterMs: 6000 }))!;

    busy.value = true;
    await nextTick();
    vi.advanceTimersByTime(299);
    expect(wait.visible.value).toBe(false);
    vi.advanceTimersByTime(1);
    expect(wait.visible.value).toBe(true);

    vi.advanceTimersByTime(2700);
    expect(wait.elapsed.value).toBe(3);
    expect(wait.slow.value).toBe(false);
    vi.advanceTimersByTime(3000);
    expect(wait.slow.value).toBe(true);

    busy.value = false;
    await nextTick();
    expect(wait.visible.value).toBe(false);
    expect(wait.slow.value).toBe(false);
    scope.stop();
  });

  it("starts over when a new wait begins", async () => {
    const busy = ref(true);
    const scope = effectScope();
    const wait = scope.run(() => useWaitStatus(busy))!;
    vi.advanceTimersByTime(5000);
    expect(wait.elapsed.value).toBe(5);

    busy.value = false;
    await nextTick();
    busy.value = true;
    await nextTick();
    expect(wait.elapsed.value).toBe(0);
    expect(wait.visible.value).toBe(false);
    scope.stop();
  });

  it("stops its timers when its scope ends", async () => {
    const scope = effectScope();
    const wait = scope.run(() => useWaitStatus(true))!;
    scope.stop();
    vi.advanceTimersByTime(5000);

    expect(wait.visible.value).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
