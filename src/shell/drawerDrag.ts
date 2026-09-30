import { onScopeDispose, ref, watch } from "vue";

/** Width of the left edge a finger opens the drawer from (installed app only). */
export const EDGE_WIDTH = 20;
/** Movement before a gesture commits to an axis; a vertical one is left to scrolling. */
const AXIS_LOCK = 8;
/** The sheet drag's flick: fast AND already moving. */
const FLICK_VELOCITY = 0.5;
const FLICK_MIN_DISTANCE = 40;

/**
 * Where a released drag settles: a flick decides by its direction, otherwise the drawer stays open
 * past half its width.
 */
export function settlesOpen({ offset, startOffset, width, velocity }: {
  offset: number;
  startOffset: number;
  width: number;
  /** px/ms, positive towards open. */
  velocity: number;
}): boolean {
  if (Math.abs(offset - startOffset) > FLICK_MIN_DISTANCE) {
    if (velocity > FLICK_VELOCITY) return true;
    if (velocity < -FLICK_VELOCITY) return false;
  }
  return offset > width / 2;
}

export interface DrawerDragOptions {
  /** Whether the gestures are live at all (phone width, signed in): no listener exists while it is false. */
  enabled: () => boolean;
  /** The drawer's width in px (the stage travels this far). */
  width: () => number;
  isOpen: () => boolean;
  /** Whether a drag from the left edge may open it (installed app). */
  canOpenFromEdge: () => boolean;
  /** A drag took over (horizontal): the stage must detach before the first frame moves. */
  onStart: () => void;
  /** The finger let go: open or closed. */
  onSettle: (open: boolean) => void;
}

/**
 * The push drawer's gestures: open by dragging from the left edge, close by dragging the drawer or
 * the pushed page left. The drawer follows the finger (`offset`) and settles open or closed on
 * release. Touch events, because the drawer's list keeps native vertical scrolling and only a
 * non-passive touchmove can take a horizontal gesture over. The window listeners exist only while
 * `enabled()` and are removed with the scope.
 *
 * Bind `closeEvents` on the drawer panel and on the pushed page's tap layer.
 */
export function useDrawerDrag(options: DrawerDragOptions) {
  const offset = ref(0);
  const dragging = ref(false);

  let tracking = false;
  let axis: "x" | "y" | null = null;
  let startX = 0;
  let startY = 0;
  let startOffset = 0;
  let lastX = 0;
  let lastTime = 0;
  let velocity = 0;

  function begin(touch: Touch, from: number) {
    tracking = true;
    axis = null;
    startX = lastX = touch.clientX;
    startY = touch.clientY;
    startOffset = from;
    lastTime = performance.now();
    velocity = 0;
  }

  function move(event: TouchEvent) {
    const touch = event.touches[0];
    if (!tracking || !touch) return;

    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    if (!axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK) return;
      axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      // Vertical, or an edge drag that starts leftwards: not ours.
      if (axis === "y" || (startOffset === 0 && dx < 0)) {
        tracking = false;
        return;
      }
      dragging.value = true;
      offset.value = startOffset;
      options.onStart();
    }

    const now = performance.now();
    velocity = (touch.clientX - lastX) / Math.max(now - lastTime, 1);
    lastX = touch.clientX;
    lastTime = now;
    offset.value = Math.min(options.width(), Math.max(0, startOffset + dx));
    if (event.cancelable) event.preventDefault();
  }

  function end() {
    if (!tracking) return;
    tracking = false;
    if (!dragging.value) return;

    dragging.value = false;
    options.onSettle(settlesOpen({ offset: offset.value, startOffset, width: options.width(), velocity }));
  }

  /** Forgets a gesture in progress without settling it (the drawer was closed from outside). */
  function cancel() {
    tracking = false;
    dragging.value = false;
  }

  // The left edge: window listeners, so the page underneath needs no handlers.
  function onEdgeStart(event: TouchEvent) {
    const touch = event.touches[0];
    if (!touch || event.touches.length !== 1 || options.isOpen() || !options.canOpenFromEdge()) return;
    if (touch.clientX > EDGE_WIDTH) return;
    begin(touch, 0);
  }

  let listening = false;

  function listen() {
    if (listening) return;
    listening = true;
    window.addEventListener("touchstart", onEdgeStart, { passive: true });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end);
    window.addEventListener("touchcancel", end);
  }

  function unlisten() {
    if (!listening) return;
    listening = false;
    window.removeEventListener("touchstart", onEdgeStart);
    window.removeEventListener("touchmove", move);
    window.removeEventListener("touchend", end);
    window.removeEventListener("touchcancel", end);
    cancel();
  }

  watch(options.enabled, (on) => (on ? listen() : unlisten()), { immediate: true });
  onScopeDispose(unlisten);

  // The open drawer and the pushed page: the move and end arrive on window.
  const closeEvents = {
    onTouchstartPassive(event: TouchEvent) {
      const touch = event.touches[0];
      if (touch && event.touches.length === 1 && options.isOpen()) begin(touch, options.width());
    },
  };

  return { offset, dragging, closeEvents, cancel };
}
