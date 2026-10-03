/** Fired on `document` to close every open popover and menu; see `closeOverlays`. */
export const CLOSE_OVERLAYS_EVENT = "vue-core:close-overlays";

/**
 * Closes every open popover and menu: for something that takes the screen over (the prompt of an expired session),
 * so a menu does not hang open beside it. Dialogs are not touched: they have their own stack.
 */
export function closeOverlays(): void {
  document.dispatchEvent(new Event(CLOSE_OVERLAYS_EVENT));
}
