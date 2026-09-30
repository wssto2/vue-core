import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { EDGE_WIDTH, settlesOpen, useDrawerDrag } from "./drawerDrag";

const width = 320;

describe("settlesOpen", () => {
  it("settles by distance: open past half the drawer's width", () => {
    expect(settlesOpen({ offset: 161, startOffset: 0, width, velocity: 0 })).toBe(true);
    expect(settlesOpen({ offset: 159, startOffset: 0, width, velocity: 0 })).toBe(false);
    expect(settlesOpen({ offset: 170, startOffset: width, width, velocity: 0 })).toBe(true);
    expect(settlesOpen({ offset: 150, startOffset: width, width, velocity: 0 })).toBe(false);
  });

  it("a flick decides by its direction once it has travelled", () => {
    expect(settlesOpen({ offset: 60, startOffset: 0, width, velocity: 0.8 })).toBe(true);
    expect(settlesOpen({ offset: 260, startOffset: width, width, velocity: -0.8 })).toBe(false);
  });

  it("speed without distance is not a flick (a jittery tap)", () => {
    expect(settlesOpen({ offset: 30, startOffset: 0, width, velocity: 2 })).toBe(false);
    expect(settlesOpen({ offset: 300, startOffset: width, width, velocity: -2 })).toBe(true);
  });
});

function touch(type: string, x: number, y = 100): TouchEvent {
  const point = { clientX: x, clientY: y } as Touch;
  const event = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent;
  Object.defineProperty(event, "touches", { value: type === "touchend" ? [] : [point] });
  return event;
}

function setup(state: { enabled?: boolean; open?: boolean; edge?: boolean } = {}) {
  const enabled = ref(state.enabled ?? true);
  const open = ref(state.open ?? false);
  const settled: boolean[] = [];
  const started = vi.fn();
  const scope = effectScope();
  const drag = scope.run(() =>
    useDrawerDrag({
      enabled: () => enabled.value,
      width: () => width,
      isOpen: () => open.value,
      canOpenFromEdge: () => state.edge ?? true,
      onStart: started,
      onSettle: (value) => settled.push(value),
    }),
  )!;
  return { drag, enabled, open, settled, started, scope };
}

afterEach(() => vi.restoreAllMocks());

describe("useDrawerDrag", () => {
  it("opens by a horizontal drag from the left edge and settles by distance", () => {
    const { drag, settled, started, scope } = setup();

    window.dispatchEvent(touch("touchstart", EDGE_WIDTH - 1));
    window.dispatchEvent(touch("touchmove", 40));
    expect(drag.dragging.value).toBe(true);
    expect(started).toHaveBeenCalledTimes(1);
    window.dispatchEvent(touch("touchmove", 200));
    expect(drag.offset.value).toBe(181); // the finger moved 181 px from where it touched down
    window.dispatchEvent(touch("touchend", 200));

    expect(settled).toEqual([true]);
    expect(drag.dragging.value).toBe(false);
    scope.stop();
  });

  it("leaves a vertical gesture, a touch away from the edge and a leftward edge drag to the page", () => {
    const { drag, settled, scope } = setup();

    window.dispatchEvent(touch("touchstart", 5, 100));
    window.dispatchEvent(touch("touchmove", 6, 200)); // vertical: scrolling
    window.dispatchEvent(touch("touchend", 6, 200));
    window.dispatchEvent(touch("touchstart", 100, 100)); // not at the edge
    window.dispatchEvent(touch("touchmove", 250, 100));
    window.dispatchEvent(touch("touchend", 250, 100));
    window.dispatchEvent(touch("touchstart", 5, 100));
    window.dispatchEvent(touch("touchmove", -20, 100)); // leftward from the edge
    window.dispatchEvent(touch("touchend", -20, 100));

    expect(drag.dragging.value).toBe(false);
    expect(settled).toEqual([]);
    scope.stop();
  });

  it("does not open from the edge where the edge belongs to the browser (not installed)", () => {
    const { drag, scope } = setup({ edge: false });
    window.dispatchEvent(touch("touchstart", 5));
    window.dispatchEvent(touch("touchmove", 120));
    expect(drag.dragging.value).toBe(false);
    scope.stop();
  });

  it("closes by dragging the open drawer left", () => {
    const { drag, settled, scope } = setup({ open: true });

    drag.closeEvents.onTouchstartPassive(touch("touchstart", 300));
    window.dispatchEvent(touch("touchmove", 150));
    window.dispatchEvent(touch("touchend", 150));

    expect(settled).toEqual([false]);
    scope.stop();
  });

  it("adds no window listener while disabled, and removes them all when disabled again or disposed", async () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { enabled, scope } = setup({ enabled: false });
    expect(add.mock.calls.filter(([type]) => String(type).startsWith("touch"))).toHaveLength(0);

    enabled.value = true;
    await nextTick();
    expect(add.mock.calls.filter(([type]) => String(type).startsWith("touch"))).toHaveLength(4);

    enabled.value = false;
    await nextTick();
    expect(remove.mock.calls.filter(([type]) => String(type).startsWith("touch"))).toHaveLength(4);

    enabled.value = true;
    await nextTick();
    scope.stop();
    expect(remove.mock.calls.filter(([type]) => String(type).startsWith("touch"))).toHaveLength(8);
  });
});
