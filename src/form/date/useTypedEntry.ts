import { computed, ref, watch, type Ref } from "vue";

export interface TypedEntryOptions {
  /** The field's value. */
  model: Ref<string | null>;
  /** The text a value is shown as. */
  display: (value: string) => string;
  /** Reads typed text (never empty): the value, or the message that says what is wrong with it. */
  parse: (text: string) => { value: string } | { error: string };
}

/**
 * The typed half of a date or time field. Typing is a draft that becomes the value when it is committed (Enter, leaving
 * the field): text that parses sets it; text that does not stays in the field next to its message, and the value is
 * `null` until it is a real one (the form never submits the old value under a text that says something else); empty text
 * clears. A value that arrives from outside (a pick in the calendar, a reset) replaces the draft.
 */
export function useTypedEntry(options: TypedEntryOptions) {
  const draft = ref<string | null>(null);
  const message = ref<string | undefined>();

  const text = computed(() => draft.value ?? (options.model.value ? options.display(options.model.value) : ""));
  /** What the draft would be, while it is a real value: the calendar follows it as you type. */
  const typed = computed(() => {
    if (draft.value === null || draft.value.trim() === "") return null;
    const result = options.parse(draft.value);
    return "value" in result ? result.value : null;
  });

  function input(value: string) {
    draft.value = value;
    message.value = undefined;
  }

  /** The value, from a pick: it ends any draft. */
  function set(value: string | null) {
    draft.value = null;
    message.value = undefined;
    options.model.value = value;
  }

  function commit() {
    if (draft.value === null) return;
    if (draft.value.trim() === "") return set(null);
    const result = options.parse(draft.value);
    if ("error" in result) {
      message.value = result.error;
      if (options.model.value !== null) options.model.value = null;
      return;
    }
    set(result.value);
  }

  watch(options.model, (value) => {
    if (value === null && message.value) return; // our own null, next to the text that explains it
    draft.value = null;
    message.value = undefined;
  });

  return { text, typed, message, input, commit, set };
}
