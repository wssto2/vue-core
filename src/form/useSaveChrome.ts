import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useI18n } from "vue-i18n";
import { usePageChrome } from "../page";
import { useLeaveGuard } from "./leaveGuard";
import type { Form } from "./useForm";

export interface SaveChromeOptions {
  /** The form being edited: its dirty state drives the status, Cancel and the leave guard; its submitting state the spinner. */
  readonly form: Pick<Form<object>, "dirty" | "submitting">;
  /** What the primary action says ("Create ticket"); by default "Save". */
  readonly label?: MaybeRefOrGetter<string | undefined>;
  /** Whether the viewer may save (the feature's `can(…)`); without it the page shows no action. Default true. */
  readonly allowed?: MaybeRefOrGetter<boolean>;
  /** False while the record is still loading. Default true. */
  readonly ready?: MaybeRefOrGetter<boolean>;
  /** The action id (for tests and shortcuts). Default `save`. */
  readonly id?: string;
  readonly save: () => void;
  /** Cancel: put the saved values back. */
  readonly cancel: () => void;
}

/**
 * The page chrome of a page that edits directly (a long form, a settings section): Save as the page's primary action with
 * a spinner while it works, "Unsaved changes" beside it, Cancel (while there are edits) in place of Back, and the leave guard.
 * Inside an `EditorPage` this is done for you; use it for a page of your own. Call it from a component rendered inside the
 * page shell (or where the app's page chrome is installed).
 *
 *   useSaveChrome({ form, label: () => t("save"), allowed: () => can("tickets:update"), save: submit, cancel: () => form.reset() });
 */
export function useSaveChrome(options: SaveChromeOptions): void {
  const { t } = useI18n();
  const shown = computed(() => (toValue(options.ready) ?? true) && (toValue(options.allowed) ?? true));
  const editing = computed(() => shown.value && options.form.dirty.value);

  useLeaveGuard(() => shown.value && options.form.dirty.value);

  usePageChrome({
    actions: () =>
      shown.value
        ? [
            {
              id: options.id ?? "save",
              label: toValue(options.label) ?? t("core.actions.save"),
              shortLabel: t("core.actions.save"),
              icon: "save",
              placement: "primary" as const,
              processing: options.form.submitting.value,
              onClick: options.save,
            },
          ]
        : [],
    leading: () => (editing.value ? { id: `${options.id ?? "save"}-cancel`, label: t("core.actions.cancel"), prominence: "plain" as const, onClick: options.cancel } : null),
    status: () => (editing.value ? t("core.form.unsaved_changes") : null),
  });
}
