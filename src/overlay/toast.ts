import { toast as sonner } from "vue-sonner";

/** An action on a toast: Undo, Retry. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  description?: string;
  action?: ToastAction;
  /** Milliseconds before it goes away; a loading toast stays until dismissed. */
  duration?: number;
  /** Showing a toast with the id of a visible one updates it instead of adding another. */
  id?: string | number;
}

/** Identifies a toast, to update or dismiss it. */
export type ToastId = string | number;

/**
 * Brief, non-blocking feedback: a confirmation, an error with Retry, a reversible action with
 * Undo (prefer Undo to a confirmation dialog whenever an action can be reversed). Toasts are one
 * queue for the whole page, rendered by the single `<Toaster />` the app mounts.
 *
 *   toast.success(t("saved"));
 *   toast.error(t("couldNotSave"), { action: { label: t("retry"), onClick: save } });
 *   const id = toast.loading(t("deleting"));  …  toast.dismiss(id);
 */
export const toast = {
  success: (message: string, options?: ToastOptions): ToastId => sonner.success(message, options),
  info: (message: string, options?: ToastOptions): ToastId => sonner.info(message, options),
  warning: (message: string, options?: ToastOptions): ToastId => sonner.warning(message, options),
  error: (message: string, options?: ToastOptions): ToastId => sonner.error(message, options),
  loading: (message: string, options?: ToastOptions): ToastId => sonner.loading(message, options),
  /** Dismisses one toast, or all of them without an id. */
  dismiss: (id?: ToastId): void => void sonner.dismiss(id),
};
