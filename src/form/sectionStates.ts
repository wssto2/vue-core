import { computed, getCurrentScope, onScopeDispose, ref, watch, type ComputedRef } from "vue";
import type { SectionFormState, SectionIndex } from "../page";

/**
 * What a long form says about each of its sections, from the fields themselves: a section has as many errors as it contains
 * elements marked `data-field-error`, and as many required fields as it contains `data-field-required` (filled ones carry
 * `data-field-filled`). Every `Field` marks itself, so the page needs no registry of fields and a section of your own
 * making (a custom control inside a `Field`) counts the same way. Recomputed when the page changes, batched to a frame.
 */
export function useSectionStates(index: SectionIndex): { states: ComputedRef<Readonly<Record<string, SectionFormState>>>; totals: ComputedRef<{ filled: number; total: number }> } {
  const version = ref(0);
  let frame = 0;
  const bump = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      version.value++;
    });
  };

  const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(bump);
  watch(
    () => index.sections.value,
    (sections) => {
      observer?.disconnect();
      for (const section of sections) {
        observer?.observe(section.element, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-field-error", "data-field-required", "data-field-filled"] });
      }
      bump();
    },
    { immediate: true },
  );
  if (getCurrentScope())
    onScopeDispose(() => {
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    });

  const states = computed(() => {
    void version.value;
    return Object.fromEntries(
      index.sections.value.map((section) => [
        section.id,
        {
          errors: section.element.querySelectorAll("[data-field-error]").length,
          required: { total: section.element.querySelectorAll("[data-field-required]").length, filled: section.element.querySelectorAll("[data-field-required][data-field-filled]").length },
        },
      ]),
    );
  });
  const totals = computed(() => Object.values(states.value).reduce((sum, state) => ({ filled: sum.filled + state.required.filled, total: sum.total + state.required.total }), { filled: 0, total: 0 }));

  return { states, totals };
}
