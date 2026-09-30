import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { useSheetDrag } from "./useSheetDrag";

// A gesture's speed comes from performance.now(): each move below takes `STEP_MS` (a slow drag).
let clock = 0;
const STEP_MS = 100;
vi.spyOn(performance, "now").mockImplementation(() => clock);
afterEach(() => {
  clock = 0;
});

function setup(options: { enabled?: boolean; scrollTop?: number; dismiss?: () => boolean | Promise<boolean> } = {}) {
  const body = document.createElement("div");
  Object.defineProperty(body, "scrollTop", { value: options.scrollTop ?? 0 });
  const panel = document.createElement("div");
  Object.defineProperty(panel, "offsetHeight", { value: 600 });
  const onDismiss = vi.fn(options.dismiss ?? (() => true));
  const drag = useSheetDrag({ enabled: ref(options.enabled ?? true), panel: ref(panel), body: ref(body), onDismiss });
  const handle = document.createElement("div");
  const down = (y: number) =>
    drag.handleEvents.onPointerdown({ button: 0, target: handle, currentTarget: Object.assign(handle, { setPointerCapture() {} }), pointerId: 1, clientY: y } as unknown as PointerEvent);
  const move = (y: number, takes = STEP_MS) => {
    clock += takes;
    drag.handleEvents.onPointermove({ buttons: 1, clientY: y } as PointerEvent);
  };
  return { drag, onDismiss, down, move, handle };
}

describe("useSheetDrag", () => {
  it("follows the finger from the handle and dismisses past the distance", async () => {
    const { drag, onDismiss, down, move } = setup();
    down(100);
    move(150);
    expect(drag.dragOffset.value).toBe(50);
    expect(drag.panelStyle.value).toEqual({ transform: "translateY(50px)" });

    move(260);
    drag.handleEvents.onPointerup();
    await vi.waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
    // It slides on from where the finger let go, at least to the panel height.
    await vi.waitFor(() => expect(drag.dragOffset.value).toBe(600));
  });

  it("dismisses a quick flick even when it is short", async () => {
    const { drag, onDismiss, down, move } = setup();
    down(100);
    move(150, 10);
    drag.handleEvents.onPointerup();

    await vi.waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
  });

  it("a tap's jitter is not a flick", async () => {
    const { drag, onDismiss, down, move } = setup();
    down(100);
    move(102, 1);
    drag.handleEvents.onPointerup();

    await vi.waitFor(() => expect(drag.dragOffset.value).toBe(0));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("snaps back when released short of the distance", async () => {
    const { drag, onDismiss, down, move } = setup();
    down(100);
    move(150);
    drag.handleEvents.onPointerup();

    await vi.waitFor(() => expect(drag.dragOffset.value).toBe(0));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("snaps back when a dirty guard keeps the sheet open", async () => {
    const { drag, onDismiss, down, move } = setup({ dismiss: () => Promise.resolve(false) });
    down(0);
    move(300);
    drag.handleEvents.onPointerup();

    await vi.waitFor(() => expect(onDismiss).toHaveBeenCalled());
    await vi.waitFor(() => expect(drag.dragOffset.value).toBe(0));
  });

  it("does nothing when disabled (wide screens)", () => {
    const { drag, down, move } = setup({ enabled: false });
    down(0);
    move(300);

    expect(drag.dragOffset.value).toBe(0);
    expect(drag.panelStyle.value).toBeUndefined();
  });

  it("a press on a control in the header is a tap, not a drag", () => {
    const { drag, handle, move } = setup();
    const button = handle.appendChild(document.createElement("button"));
    drag.handleEvents.onPointerdown({ button: 0, target: button, currentTarget: Object.assign(handle, { setPointerCapture() {} }), pointerId: 1, clientY: 0 } as unknown as PointerEvent);
    move(200);

    expect(drag.dragOffset.value).toBe(0);
  });

  it("a hovering mouse never moves the sheet", () => {
    const { drag, down } = setup();
    down(0);
    drag.handleEvents.onPointermove({ buttons: 0, clientY: 300 } as PointerEvent);

    expect(drag.dragOffset.value).toBe(0);
  });

  it("from the body it scrolls first: a drag starts only at the top, moving down", () => {
    const scrolled = setup({ scrollTop: 40 });
    scrolled.drag.bodyEvents.onTouchstartPassive({ touches: [{ clientY: 0 }] } as unknown as TouchEvent);
    const consumedScrolled = scrolled.drag.bodyEvents.onTouchmove({ touches: [{ clientY: 100 }], cancelable: true, preventDefault() {} } as unknown as TouchEvent);
    expect(consumedScrolled).toBeUndefined();
    expect(scrolled.drag.dragOffset.value).toBe(0);

    const atTop = setup({ scrollTop: 0 });
    const prevent = vi.fn();
    atTop.drag.bodyEvents.onTouchstartPassive({ touches: [{ clientY: 0 }] } as unknown as TouchEvent);
    atTop.drag.bodyEvents.onTouchmove({ touches: [{ clientY: 100 }], cancelable: true, preventDefault: prevent } as unknown as TouchEvent);
    expect(atTop.drag.dragOffset.value).toBe(0); // the gesture's first move only arms the drag
    atTop.drag.bodyEvents.onTouchmove({ touches: [{ clientY: 180 }], cancelable: true, preventDefault: prevent } as unknown as TouchEvent);
    expect(atTop.drag.dragOffset.value).toBe(80);
    expect(prevent).toHaveBeenCalled();
  });

  it("dims the backdrop as the sheet leaves", () => {
    const { drag, down, move } = setup();
    down(0);
    move(300);
    expect(drag.backdropStyle.value).toEqual({ opacity: "0.5" });
  });
});
