import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { render } from "@testing-library/vue";
import { PULL_THRESHOLD, usePullToRefresh } from "./pullToRefresh";

function touch(type: "touchstart" | "touchmove" | "touchend", points: { x: number; y: number }[] = []) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, "touches", { value: points.map((p) => ({ clientX: p.x, clientY: p.y })) });
  window.dispatchEvent(event);
}

/** Drags one finger from (100, 100) down by `dy`, then lifts it. */
function drag(dy: number, dx = 0) {
  touch("touchstart", [{ x: 100, y: 100 }]);
  touch("touchmove", [{ x: 100 + dx, y: 100 + dy }]);
  touch("touchend");
}

let pulled: ReturnType<typeof usePullToRefresh>;
const refresh = vi.fn();
let enabled = true;

beforeEach(() => {
  vi.useFakeTimers();
  enabled = true;
  refresh.mockReset();
  render(defineComponent({ setup() { pulled = usePullToRefresh(refresh, { enabled: () => enabled }); return () => h("div"); } }));
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
});
afterEach(() => vi.useRealTimers());

describe("usePullToRefresh", () => {
  it("refreshes after a downward drag past the threshold (resistance 0.5), and keeps spinning for at least 600 ms", async () => {
    drag(PULL_THRESHOLD * 2);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(pulled.refreshing.value).toBe(true);
    await vi.advanceTimersByTimeAsync(599);
    expect(pulled.refreshing.value).toBe(true);
    await vi.advanceTimersByTimeAsync(2);
    expect(pulled.refreshing.value).toBe(false);
    expect(pulled.pull.value).toBe(0);
  });

  it("does nothing for a drag that stops short of the threshold", () => {
    drag(PULL_THRESHOLD * 2 - 4);
    expect(refresh).not.toHaveBeenCalled();
    expect(pulled.pull.value).toBe(0);
  });

  it.each([
    ["upward", () => drag(-300)],
    ["more sideways than down", () => drag(160, 200)],
  ])("ignores a drag that is %s", (_name, run) => {
    run();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("ignores a drag when the page is not at the top, with two fingers, or while not enabled", () => {
    Object.defineProperty(window, "scrollY", { value: 40, configurable: true });
    drag(300);
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    touch("touchstart", [{ x: 1, y: 1 }, { x: 5, y: 5 }]);
    touch("touchmove", [{ x: 1, y: 300 }, { x: 5, y: 300 }]);
    touch("touchend");
    enabled = false;
    drag(300);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not start a second refresh while one runs", async () => {
    drag(300);
    drag(300);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(700);
  });
});
