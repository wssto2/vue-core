import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { useCountUp } from "./useCountUp";

function reducedMotion(reduced: boolean) {
  window.matchMedia = ((query: string) => ({ matches: reduced && query === "(prefers-reduced-motion: reduce)" })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  reducedMotion(false);
});
afterEach(() => vi.useRealTimers());

describe("useCountUp", () => {
  it("starts at the value it has and counts up when a value arrives from nothing", async () => {
    const target = ref(0);
    const shown = effectScope().run(() => useCountUp(target, 700))!;
    expect(shown.value).toBe(0);

    target.value = 1000;
    await nextTick();
    expect(shown.value).toBe(0);
    await vi.advanceTimersByTimeAsync(350);
    expect(shown.value).toBeGreaterThan(0);
    expect(shown.value).toBeLessThan(1000);
    await vi.advanceTimersByTimeAsync(400);
    expect(shown.value).toBe(1000);
  });

  it("shows a later change at once", async () => {
    const target = ref(500);
    const shown = effectScope().run(() => useCountUp(target))!;
    expect(shown.value).toBe(500);
    target.value = 800;
    await nextTick();
    expect(shown.value).toBe(800);
    target.value = 0;
    await nextTick();
    expect(shown.value).toBe(0);
  });

  it("shows the value at once under reduced motion", async () => {
    reducedMotion(true);
    const target = ref(0);
    const shown = effectScope().run(() => useCountUp(target))!;
    target.value = 1000;
    await nextTick();
    expect(shown.value).toBe(1000);
  });

  it("stops counting when its scope ends", async () => {
    const scope = effectScope();
    const target = ref(0);
    const shown = scope.run(() => useCountUp(target, 700))!;
    target.value = 1000;
    await nextTick();
    await vi.advanceTimersByTimeAsync(200);
    const partial = shown.value;
    scope.stop();
    await vi.advanceTimersByTimeAsync(700);
    expect(shown.value).toBe(partial);
  });
});
