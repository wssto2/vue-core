import { computed, ref, type Ref } from "vue";

/**
 * A released drag dismisses past DISMISS_DISTANCE, or as a flick: faster than DISMISS_VELOCITY
 * (px/ms) and already FLICK_MIN_DISTANCE down. Velocity alone is noise (a 2 px jitter inside 1 ms
 * reads as 2 px/ms on a plain tap).
 */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.5;
const FLICK_MIN_DISTANCE = 40;

export interface SheetDragOptions {
  /** Only drag while this is true (only in the bottom-sheet presentation). */
  enabled: Ref<boolean>;
  panel: Ref<HTMLElement | null>;
  /** The scrollable body; a body gesture only drags once it is scrolled to the top. */
  body: Ref<HTMLElement | null>;
  /** Called when a released drag should dismiss. Resolve false when the sheet stayed open (a dirty guard said no) and it snaps back. */
  onDismiss: () => Promise<boolean> | boolean;
}

/**
 * Swipe-to-dismiss for bottom and page sheets. From the grabber or header a drag starts at once;
 * from the body only once the body is scrolled to the top and the finger moves down, so a
 * downward swipe scrolls content first, exactly like a native sheet.
 *
 * Bind `handleEvents` on the grabber/header (with `touch-action: none`) and `bodyEvents` on the
 * scrolling body.
 */
export function useSheetDrag({ enabled, panel, body, onDismiss }: SheetDragOptions) {
  const dragOffset = ref(0);
  const dragging = ref(false);

  let startY = 0;
  let lastY = 0;
  let lastTime = 0;
  let velocity = 0;
  /** Whether the gesture began in the scrollable body (vs. the handle/header). */
  let fromBody = false;
  /** A body gesture only becomes a drag once it moves down while scrolled to the top. */
  let tracking = false;

  function begin(clientY: number, inBody: boolean) {
    if (!enabled.value) return;

    startY = lastY = clientY;
    lastTime = performance.now();
    velocity = 0;
    fromBody = inBody;
    tracking = true;
    dragging.value = !inBody;
  }

  /** Returns true when the move was consumed as a drag (the caller prevents default). */
  function move(clientY: number): boolean {
    if (!tracking) return false;

    const delta = clientY - startY;

    if (!dragging.value) {
      // A body gesture: scrolling wins unless the body is already at the top and the finger moves down.
      const atTop = (body.value?.scrollTop ?? 0) <= 0;

      if (!fromBody || !atTop || delta <= 0) {
        if (delta < 0 || !atTop) tracking = false;
        return false;
      }

      dragging.value = true;
      startY = clientY;
    }

    const now = performance.now();
    velocity = (clientY - lastY) / Math.max(now - lastTime, 1);
    lastY = clientY;
    lastTime = now;
    dragOffset.value = Math.max(0, clientY - startY);

    return true;
  }

  async function end() {
    if (!tracking) return;

    tracking = false;
    if (!dragging.value) return;

    dragging.value = false;

    const flicked = velocity > DISMISS_VELOCITY && dragOffset.value > FLICK_MIN_DISTANCE;
    if (dragOffset.value > DISMISS_DISTANCE || flicked) {
      // Continue from where the finger let go instead of snapping back to 0 before sliding out.
      const released = dragOffset.value;
      if (await onDismiss()) {
        dragOffset.value = Math.max(released, panel.value?.offsetHeight ?? window.innerHeight);
        return;
      }
    }

    dragOffset.value = 0;
  }

  function reset() {
    tracking = false;
    dragging.value = false;
    dragOffset.value = 0;
  }

  // Handle / header: pointer events, with touch-action: none on the element so the browser does
  // not scroll the page instead.
  const handleEvents = {
    onPointerdown(event: PointerEvent) {
      if (event.button !== 0) return;
      // A press on a control in the header (Cancel, Save) is a tap, not a drag.
      if ((event.target as HTMLElement | null)?.closest('button, a, input, [role="button"]')) return;

      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      begin(event.clientY, false);
    },
    onPointermove(event: PointerEvent) {
      // Only a pressed pointer drags; a hovering mouse must not move the sheet.
      if (event.buttons === 0) {
        void end();
        return;
      }

      move(event.clientY);
    },
    onPointerup: () => void end(),
    onPointercancel: () => void end(),
  };

  // Body: touch events, because the body must keep native scrolling and only a non-passive
  // touchmove can take the gesture over once it becomes a drag.
  const bodyEvents = {
    onTouchstartPassive(event: TouchEvent) {
      const touch = event.touches[0];
      if (touch && event.touches.length === 1) begin(touch.clientY, true);
    },
    onTouchmove(event: TouchEvent) {
      const touch = event.touches[0];
      if (touch && move(touch.clientY) && event.cancelable) event.preventDefault();
    },
    onTouchend: () => void end(),
    onTouchcancel: () => void end(),
  };

  const panelStyle = computed(() =>
    !enabled.value || dragOffset.value === 0 ? undefined : { transform: `translateY(${dragOffset.value}px)` },
  );

  const backdropStyle = computed(() => {
    if (!enabled.value || dragOffset.value === 0) return undefined;

    const height = panel.value?.offsetHeight || window.innerHeight;
    return { opacity: String(Math.max(0, 1 - dragOffset.value / height)) };
  });

  return { dragOffset, dragging, handleEvents, bodyEvents, panelStyle, backdropStyle, reset };
}
