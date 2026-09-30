import { coreIcons } from "../icon/core";
import { useIconSet } from "../icon/environment";
import type { IconName } from "../icon";

/**
 * Narrows the icon name the server put in its menu to one the application can draw: an icon that is
 * in neither the installed set nor the library's own is left out instead of logging an error on
 * every render of the menu. Call it while setting up a component.
 */
export function useKnownIcon(): (name: string | null | undefined) => IconName | null {
  const installed = useIconSet();
  const has = (set: object, name: string) => Object.prototype.hasOwnProperty.call(set, name);
  return (name) => (name && (installed[name] !== undefined || has(coreIcons, name)) ? (name as IconName) : null);
}
