import { nextTick } from "vue";
import type { SectionIndex } from "../page";

const CONTROLS = "input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex='-1'])";

/**
 * Moves focus to the first field with an error (fields mark themselves with `data-field-error`), after a
 * failed submit. With the page's section index, a field inside a collapsed or scrolled-away section is revealed
 * first. Returns whether there was one. Nothing moves while the user is typing: call it from the submit's answer, not from a watcher.
 */
export async function focusFirstError(root: ParentNode = document, sections?: SectionIndex | null): Promise<boolean> {
  const rows = [...root.querySelectorAll<HTMLElement>("[data-field-error]")];
  // The first field with something to focus: a locked one cannot take focus, so the next one does.
  const row = rows.find((each) => each.matches(CONTROLS) || each.querySelector(CONTROLS)) ?? rows[0];
  if (!row) return false;
  const section = sections?.sections.value.find((each) => each.element.contains(row));
  if (section) {
    await sections?.scrollTo(section.id, { updateUrl: false });
    await nextTick();
  }
  const control = row.matches(CONTROLS) ? row : row.querySelector<HTMLElement>(CONTROLS);
  (control ?? row).scrollIntoView?.({ block: "center" });
  (control ?? row).focus({ preventScroll: true });
  return true;
}

/**
 * Marks a field you wired by hand (a value inside a list: `v-model="line.quantity"` with its own `:error`) as the place where the errors of
 * `path` show, so `FormErrors` does not list them as fields that are not on screen: `<NumberField v-model="line.quantity" v-bind="fieldKey(`lines.${i}.quantity`)" />`.
 */
export const fieldKey = (path: string): { "data-field-key": string } => ({ "data-field-key": path });
