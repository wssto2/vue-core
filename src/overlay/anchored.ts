import { nextTick, onScopeDispose, ref, watch, type Ref } from "vue";
import {
  arrow as arrowMiddleware,
  autoUpdate,
  computePosition,
  flip,
  offset as offsetMiddleware,
  shift,
  size,
  type Placement,
  type ReferenceElement,
} from "@floating-ui/dom";

export interface AnchoredOptions {
  /** What the panel is anchored to: an element, or a point (a context menu). Null: not yet known. */
  reference: () => ReferenceElement | null;
  placement: () => Placement;
  /** Gap between the anchor and the panel, in px. */
  offset: number;
  /** Distance kept from the viewport edge, in px. */
  padding: number;
  arrow?: Ref<HTMLElement | null>;
  /** Sizes the panel to the space the browser has left (full width on phones, a max height). */
  fit?: (floating: HTMLElement, available: { width: number; height: number }) => void;
}

/**
 * Positions a floating panel against its anchor (floating-ui): it flips to the other side when
 * it would not fit, shifts to stay on screen, and follows the anchor on scroll, resize and the
 * on-screen keyboard (visualViewport). Positioning starts when `panel` renders and stops when
 * it goes away.
 */
export function useAnchoredPosition(panel: Ref<HTMLElement | null>, options: AnchoredOptions) {
  const style = ref<Record<string, string>>({ position: "fixed", left: "0px", top: "0px" });
  const arrowStyle = ref<Record<string, string>>({});
  const resolvedPlacement = ref<Placement>(options.placement());
  let stop: (() => void) | null = null;

  async function update() {
    const reference = options.reference();
    const element = panel.value;
    if (!reference || !element) return;

    const middleware = [
      offsetMiddleware(options.offset),
      flip({ padding: options.padding }),
      shift({ padding: options.padding }),
      size({
        padding: options.padding,
        apply({ availableWidth, availableHeight, elements }) {
          options.fit?.(elements.floating, { width: availableWidth, height: availableHeight });
        },
      }),
    ];
    if (options.arrow?.value) middleware.push(arrowMiddleware({ element: options.arrow.value, padding: 12 }));

    const { x, y, placement, middlewareData } = await computePosition(reference, element, {
      placement: options.placement(),
      strategy: "fixed",
      middleware,
    });

    style.value = { position: "fixed", left: `${x}px`, top: `${y}px` };
    resolvedPlacement.value = placement;
    const data = middlewareData.arrow;
    if (data) arrowStyle.value = { left: data.x != null ? `${data.x}px` : "", top: data.y != null ? `${data.y}px` : "" };
  }

  function halt() {
    stop?.();
    stop = null;
    window.visualViewport?.removeEventListener("resize", onViewportChange);
    window.visualViewport?.removeEventListener("scroll", onViewportChange);
  }
  const onViewportChange = () => void update();

  watch(panel, (element) => {
    halt();
    const reference = options.reference();
    if (!element || !reference) return;

    // A point has no element to observe: position once.
    if (reference instanceof Element) stop = autoUpdate(reference, element, () => void update());
    else void nextTick(update);
    window.visualViewport?.addEventListener("resize", onViewportChange);
    window.visualViewport?.addEventListener("scroll", onViewportChange);
  });

  onScopeDispose(halt);

  return { style, arrowStyle, resolvedPlacement, update };
}

/** The side of the panel the arrow sits on: opposite the side the panel is placed on. */
export function arrowSide(placement: Placement): "top" | "bottom" | "left" | "right" {
  const side = placement.split("-")[0] as "top" | "bottom" | "left" | "right";
  return ({ top: "bottom", bottom: "top", left: "right", right: "left" } as const)[side];
}
