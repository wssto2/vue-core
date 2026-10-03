import { useI18n } from "vue-i18n";

/**
 * How a category is named on the settings page: the application's own texts `notifications.categories.<code>.label`
 * (and an optional `.description`), the code split at its dots (`tickets.assigned` is `notifications.categories.tickets.assigned.label`).
 * A category the application gave no text is shown by its code, never by a missing key.
 */
export function useCategoryText() {
  const { t, te } = useI18n();
  return (code: string): { label: string; description?: string } => {
    const base = `notifications.categories.${code}`;
    const description = `${base}.description`;
    return { label: te(`${base}.label`) ? t(`${base}.label`) : code, ...(te(description) ? { description: t(description) } : {}) };
  };
}
