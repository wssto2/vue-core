import { ref, type Ref } from "vue";
import type { HttpClient } from "../../client";
import type { Preferences, QuietHours } from "../../modules/notification/entities";
import { notificationRoutes } from "../../modules/notification/routes";
import type { QuietHoursInput } from "../../modules/notification/schemas";
import { usePlatform } from "../../platform";
import { useLoad, type Load } from "../../state";
import { withCategory, withEmail } from "./state";

/** One person's notification settings: what the page shows and the two ways to change it. */
export interface Settings {
  /** The load of the preferences, as `AsyncSection` takes it. */
  readonly loaded: Load<Preferences>;
  /** The categories whose switch is on its way to the server: each is locked meanwhile, so a change never overtakes another. */
  readonly saving: Readonly<Ref<readonly string[]>>;
  /** Switches the e-mail of one category at once and saves it; a refusal (an enforced setting) or a failure puts the switch back and rejects. */
  setEmail(category: string, enabled: boolean): Promise<void>;
  /** Saves the quiet hours; the server's answer is what is shown after. A refusal rejects and changes nothing. */
  saveQuietHours(input: QuietHoursInput): Promise<QuietHours>;
}

/** The settings of the signed-in person, read from `GET /v1/notifications/preferences` through the platform's client. */
export function useSettings(http: HttpClient = usePlatform().http): Settings {
  const loaded = useLoad(async ({ signal }) => (await http.request(notificationRoutes.preferences, undefined, { signal })).data);
  const saving = ref<string[]>([]);

  async function setEmail(category: string, enabled: boolean): Promise<void> {
    const before = loaded.data.value;
    const previous = before?.categories.find((known) => known.category === category);
    if (!before || !previous || saving.value.includes(category)) return;
    loaded.update(withEmail(before, category, enabled));
    saving.value = [...saving.value, category];
    try {
      const { data } = await http.request(notificationRoutes.preferencesSetEmail, { category, email: enabled });
      const now = loaded.data.value;
      if (now) loaded.update(withCategory(now, data));
    } catch (error) {
      const now = loaded.data.value;
      if (now) loaded.update(withCategory(now, previous));
      throw error;
    } finally {
      saving.value = saving.value.filter((name) => name !== category);
    }
  }

  async function saveQuietHours(input: QuietHoursInput): Promise<QuietHours> {
    const { data } = await http.request(notificationRoutes.quietHours, input);
    const now = loaded.data.value;
    if (now) loaded.update({ ...now, quiet_hours: data });
    return data;
  }

  return { loaded, saving, setEmail, saveQuietHours };
}
