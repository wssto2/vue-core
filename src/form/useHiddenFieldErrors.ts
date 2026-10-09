import { computed, nextTick, ref, toValue, watch, type ComputedRef, type MaybeRefOrGetter } from "vue";
import type { Form } from "./useForm";

export interface HiddenFieldError {
  /** The path of the field (`lines.0.quantity`). */
  readonly field: string;
  /** Its first message. */
  readonly message: string;
}

/**
 * The form's errors whose field is not on screen: the draft lacks that field (a server field), or it sits in a part that is not
 * shown (a collapsed section). `FormErrors` lists them; use this for another way to say it, such as a toast when a save fails.
 *
 *   const hidden = useHiddenFieldErrors({ form });
 *   // after a refused save: toast.error(hidden.value.map((each) => `${label(each.field)}: ${each.message}`).join("; "))
 *
 * A field counts as shown while an element carries `data-field-key="<name>"` (`form.bind()` sets it) or the name of something that
 * contains it. The answer follows the errors and is worked out after the next render, so read it after `await nextTick()`.
 */
export function useHiddenFieldErrors(options: {
  readonly form: Pick<Form<object>, "errors">;
  /** Where to look for shown fields; by default the whole document. */
  readonly root?: MaybeRefOrGetter<ParentNode | null | undefined>;
}): ComputedRef<readonly HiddenFieldError[]> {
  const hidden = ref<readonly HiddenFieldError[]>([]);
  watch(
    () => options.form.errors.all(),
    async (errors) => {
      await nextTick();
      const root = toValue(options.root) ?? document;
      // A path is shown when some element carries it, or one of the paths it is inside (`lines` holds `lines.0.quantity`).
      const shown = new Set([...root.querySelectorAll("[data-field-key]")].flatMap((element) => (element.getAttribute("data-field-key") ?? "").split(/\s+/)));
      const isShown = (path: string) => path.split(".").some((_, index, parts) => shown.has(parts.slice(0, index + 1).join(".")));
      hidden.value = Object.entries(errors).flatMap(([path, messages]) => (messages[0] && !isShown(path) ? [{ field: path, message: messages[0] }] : []));
    },
    { immediate: true },
  );
  return computed(() => hidden.value);
}
