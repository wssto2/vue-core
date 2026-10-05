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
  /**
   * The user swiped the toast away (or closed it with a close button, if one is shown). Not called when it times out,
   * when its action is pressed, or when code dismisses it with `toast.dismiss(id)`.
   */
  onDismiss?: (id: ToastId) => void;
}

/** Identifies a toast, to update or dismiss it. */
export type ToastId = string | number;

// Sonner hands `onDismiss` the whole toast; ours takes its id.
const forward = ({ onDismiss, ...rest }: ToastOptions = {}) => ({
  ...rest,
  ...(onDismiss && { onDismiss: (shown: { id: ToastId }) => onDismiss(shown.id) }),
});

/**
 * Brief, non-blocking feedback: a confirmation, an error with Retry, a reversible action with
 * Undo (prefer Undo to a confirmation dialog whenever an action can be reversed). Toasts are one
 * queue for the whole page, rendered by the single `<Toaster />` the app mounts.
 *
 * `message` is the plain toast, no status icon: a neutral fact, usually with Undo. `success`, `info`,
 * `warning`, `error` and `loading` carry a status; pick one only when the status is the news.
 *
 *   toast.success(t("saved"));
 *   toast.message(t("filterDeleted"), { action: { label: t("undo"), onClick: undo }, onDismiss: commit });
 *   toast.error(t("couldNotSave"), { action: { label: t("retry"), onClick: save } });
 *   const id = toast.loading(t("deleting"));  …  toast.dismiss(id);
 */
export const toast = {
  message: (message: string, options?: ToastOptions): ToastId => sonner.message(message, forward(options)),
  success: (message: string, options?: ToastOptions): ToastId => sonner.success(message, forward(options)),
  info: (message: string, options?: ToastOptions): ToastId => sonner.info(message, forward(options)),
  warning: (message: string, options?: ToastOptions): ToastId => sonner.warning(message, forward(options)),
  error: (message: string, options?: ToastOptions): ToastId => sonner.error(message, forward(options)),
  loading: (message: string, options?: ToastOptions): ToastId => sonner.loading(message, forward(options)),
  /** Dismisses one toast, or all of them without an id. */
  dismiss: (id?: ToastId): void => void sonner.dismiss(id),
};
