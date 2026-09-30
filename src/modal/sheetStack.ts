import { computed, onUnmounted, ref, watch, type Ref } from "vue";
import { perDocument } from "../internal/perDocument";

const OPEN_SHEETS = Symbol("vue-core:open-sheets");
// The open page sheets, bottom to top. Only sheets: alerts and pickers above a sheet do not push
// it back (iOS does not either). Replaced rather than mutated, so `covered` re-evaluates on change.
const openSheets = () => perDocument(OPEN_SHEETS, () => ref<symbol[]>([]));

/**
 * Whether another sheet is open above this one: the value sheet that works out one value for a
 * field of the sheet below. Phones: the covered sheet recedes (scaled back from the top) and the
 * one above sits a little lower, so its top edge shows, as iOS stacks sheets. Wide screens:
 * dialogs are often taller than the window, so the one above is the narrower one and the dialog
 * below frames it at the sides. Closing the top sheet returns to the one below, draft intact.
 */
export function useSheetStack(isOpen: Ref<boolean>) {
  const sheets = openSheets();
  const id = Symbol("sheet");

  function remove() {
    sheets.value = sheets.value.filter((entry) => entry !== id);
  }

  watch(isOpen, (open) => {
    if (open && !sheets.value.includes(id)) sheets.value = [...sheets.value, id];
    if (!open) remove();
  }, { immediate: true });

  onUnmounted(remove);

  const covered = computed(() => {
    const index = sheets.value.indexOf(id);
    return index >= 0 && index < sheets.value.length - 1;
  });
  // A sheet opened above another sits a little lower, so the edge of the one below shows.
  const stacked = computed(() => sheets.value.indexOf(id) > 0);

  return { covered, stacked };
}
