import { useI18n } from "vue-i18n";
import { useDescribeError } from "../i18n";
import { toast } from "../overlay";
import { preferencesOf, usePlatform, type Preferences, type PreferencesPatch } from "../platform";
import { isSessionEnded } from "./signIn";

/** `Preferences` as a component uses them: `save` never rejects. */
export interface UsedPreferences<T extends object> {
  readonly value: Preferences<T>["value"];
  /** Applies the patch at once and saves it (see `Preferences.save`). A refusal is taken back and said in a toast; resolves whether it was saved. */
  save(patch: PreferencesPatch<T>): Promise<boolean>;
}

/**
 * The signed-in person's stored preferences (`preferences` of the session payload, saved through go-core identity's
 * `PUT /v1/auth/preferences`), typed with the application's own shape:
 *
 *   const preferences = usePreferences<{ dark_mode: boolean; onboarding: { tips_dismissed: string[] } }>();
 *   preferences.value.value.dark_mode;            // reactive
 *   await preferences.save({ dark_mode: true });  // at once on screen, then the server's merged answer
 *
 * A patch merges as JSON Merge Patch: objects merge, `null` deletes a key, arrays replace. Saves are sent one after another.
 * Call it in `setup`.
 */
export function usePreferences<T extends object = Record<string, unknown>>(): UsedPreferences<T> {
  const service = preferencesOf<T>(usePlatform());
  const describeError = useDescribeError();
  const { t } = useI18n();

  return {
    value: service.value,
    async save(patch) {
      try {
        await service.save(patch);
        return true;
      } catch (error) {
        if (!isSessionEnded(error)) toast.error(describeError(error, { fallback: t("core.preferences.save_failed") }));
        return false;
      }
    },
  };
}
