const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Focusable descendants in tab order. Elements that are hidden, `inert` or `aria-hidden` are
 * dropped: an unreachable element must not become the first or last stop of a focus trap.
 */
export function focusableWithin(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];

  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => {
    if (element.closest("[inert]")) return false;
    if (element.closest('[aria-hidden="true"]')) return false;
    // Test DOMs have no layout and often no checkVisibility: every candidate counts there.
    return typeof element.checkVisibility !== "function" || element.checkVisibility();
  });
}
