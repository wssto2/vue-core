import { inject, type InjectionKey, type Ref } from "vue";

/** What a part of the shell may ask of the phone navigation drawer that `ShellStage` provides. */
export interface NavigationDrawerControl {
  /** Whether there is a drawer at all right now: a phone width, signed in. A menu button shows only while it is. */
  readonly available: Readonly<Ref<boolean>>;
  /** Whether the drawer is open (or opening). */
  readonly open: Readonly<Ref<boolean>>;
  /** The id of the drawer panel, for the menu button's `aria-controls`. */
  readonly panelId: string;
  present(): void;
  /** Closes it (animated); `then` runs once the page is back in place (a sheet that must not open over the drawer). */
  dismiss(then?: () => void): void;
}

export const navigationDrawerKey: InjectionKey<NavigationDrawerControl> = Symbol("vue-core.navigationDrawer");

/**
 * The navigation drawer of the enclosing `ShellStage`, or null where there is no stage (a shell
 * without one). Whether the stage has a drawer right now is `available`.
 */
export function useNavigationDrawer(): NavigationDrawerControl | null {
  return inject(navigationDrawerKey, null);
}
