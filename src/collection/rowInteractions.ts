import { nextTick, ref } from "vue";
import { useRouter, type RouteLocationRaw } from "vue-router";
import type { SwipeAction } from "../controls";
import type { MenuItem } from "../overlay";
import type { RowAction } from "./columns";

/** Interactive elements inside a row keep their own click. */
const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"], [data-row-click-ignore]';
const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE = 8;

export interface RowInteractionOptions<Row> {
  actions: () => ((row: Row) => RowAction[]) | undefined;
  label: () => ((row: Row) => string) | undefined;
  /** Where a click on the row goes. */
  target: (row: Row) => RouteLocationRaw | null;
  /** Opens the context menu at a point. */
  presentMenu: (x: number, y: number) => void;
  moreLabel: () => string;
}

/**
 * What makes a list row behave like a native one: a click opens the record (except on its links and
 * buttons, or while text is selected), a modified click opens a new tab, a right click or a long
 * press (iOS has no contextmenu for one) lists the row's actions, and the press that opened that
 * menu never also opens the record. Swipe actions are the row's links.
 */
export function useRowInteractions<Row>(options: RowInteractionOptions<Row>) {
  const router = useRouter();
  const menuItems = ref<MenuItem[]>([]);
  const menuLabel = ref("");

  let suppressNextClick = false;
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let pressStart = { x: 0, y: 0 };

  const actionsOf = (row: Row) => options.actions()?.(row) ?? [];

  function swipeActions(row: Row): SwipeAction[] {
    return actionsOf(row)
      .filter((action) => action.href)
      .map((action) => ({ key: action.key, label: action.label, icon: action.icon, href: action.href as string, tone: action.tone ?? "neutral", external: action.external }));
  }

  function openMenu(row: Row, x: number, y: number): boolean {
    const actions = actionsOf(row);
    if (actions.length === 0) return false;
    menuLabel.value = options.label()?.(row) ?? options.moreLabel();
    menuItems.value = actions.map((action) => ({
      id: action.key,
      label: action.label,
      icon: action.icon,
      section: action.section,
      tone: action.tone === "critical" ? "critical" : undefined,
      onSelect: () => {
        if (action.onSelect) action.onSelect();
        else if (action.href) {
          if (action.external) window.open(action.href, "_blank", "noopener");
          else window.location.assign(action.href);
        }
      },
    }));
    // The menu reads its items as a prop: open it once they have rendered.
    void nextTick(() => options.presentMenu(x, y));
    return true;
  }

  function openMenuFrom(event: MouseEvent, row: Row) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    openMenu(row, rect.left, rect.bottom);
  }

  // Right click on desktop (and Android's long press, which fires contextmenu). On a link the browser's own menu wins.
  function onContextMenu(event: MouseEvent, row: Row) {
    if (!options.actions() || (event.target as HTMLElement).closest("a")) return;
    if (openMenu(row, event.clientX, event.clientY)) {
      event.preventDefault();
      suppressNextClick = true;
    }
  }

  function cancelPress() {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
  }

  // iOS Safari has no contextmenu for a long press: time it on touch.
  function onPointerDown(event: PointerEvent, row: Row) {
    suppressNextClick = false;
    if (event.pointerType !== "touch" || !options.actions()) return;
    pressStart = { x: event.clientX, y: event.clientY };
    cancelPress();
    pressTimer = setTimeout(() => {
      pressTimer = null;
      if (openMenu(row, pressStart.x, pressStart.y)) {
        suppressNextClick = true;
        navigator.vibrate?.(10);
      }
    }, LONG_PRESS_MS);
  }

  function onPointerMove(event: PointerEvent) {
    if (pressTimer && Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > MOVE_TOLERANCE) cancelPress();
  }

  // Capture phase: the press that opened the menu must not also open the record, not even through a
  // link inside the row, whose own handler would run before the row's bubbling one.
  function onClickCapture(event: MouseEvent) {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    event.preventDefault();
    event.stopPropagation();
  }

  function onClick(event: MouseEvent, row: Row) {
    const target = options.target(row);
    if (!target || (event.target as HTMLElement).closest(INTERACTIVE)) return;
    // Keep a text selection instead of navigating away from it.
    if (window.getSelection()?.toString()) return;
    if (event.metaKey || event.ctrlKey) {
      window.open(router.resolve(target).href, "_blank");
      return;
    }
    void router.push(target);
  }

  return { menuItems, menuLabel, swipeActions, openMenuFrom, onContextMenu, onPointerDown, onPointerMove, cancelPress, onClickCapture, onClick, actionsOf };
}
