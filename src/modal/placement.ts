import { toValue, type InjectionKey, type MaybeRefOrGetter } from "vue";

/**
 * Where a `Modal` stands on wide screens (phones always get the page sheet). The default is the
 * centre of the viewport. An application shown inside a frame that has chrome of its own (the page
 * around it covers part of the viewport) aligns dialogs to the top and shifts them away from it.
 */
export interface ModalPlacement {
  /** `"center"` (default) or `"top"`: near the top edge, where a tall dialog does not push its header out of sight. */
  readonly align?: "center" | "top";
  /** A horizontal shift in pixels; negative moves the dialog left. Default 0. */
  readonly offsetX?: number;
}

/**
 * The placement of every modal of the application, once, reactive when given as a ref or getter:
 *
 *   app.provide(modalPlacementKey, () => ({ align: "top", offsetX: -hostSidebarWidth.value / 2 }));
 *
 * A modal's own `placement` prop wins, field by field.
 */
export const modalPlacementKey: InjectionKey<MaybeRefOrGetter<ModalPlacement>> = Symbol("vue-core.modalPlacement");

/** The placement to apply: the app's, with the modal's own fields on top. */
export function resolvePlacement(app: MaybeRefOrGetter<ModalPlacement> | undefined, own: ModalPlacement | undefined): Required<ModalPlacement> {
  const base = app === undefined ? {} : toValue(app);
  return { align: own?.align ?? base.align ?? "center", offsetX: own?.offsetX ?? base.offsetX ?? 0 };
}
