import { computed, inject, onBeforeUnmount, ref, type ComputedRef, type InjectionKey, type Ref } from "vue";
import { useCompactPresentation } from "../internal/mediaQuery";

/** What every field takes besides its value. A field is one labelled row: the label, the control, a hint, the error. */
export interface FieldProps {
  label?: string;
  /** The label stays the control's accessible name (and the read-mode row's) but is not drawn: for a field whose group header already says it. */
  labelHidden?: boolean;
  /** A sentence under the label (under the control outside a group) that says what to enter. */
  hint?: string;
  /** The message to show; `form.bind()` supplies it. */
  error?: string;
  /** Marks the field required and counts it in the required-field progress of a long form. */
  required?: boolean;
  /** `false` reads this one field as a value row whatever its form says. Read mode is normally the form's or the group's (`FormView` / `FormGroup :editable`). */
  editable?: boolean;
  /** Locked: the value cannot change while the form edits (dimmed on desktop, a value row on phones). */
  disabled?: boolean;
  /** Why a locked value cannot change, for a tooltip and screen readers; the group's `lockedFooter` says it once for the eye. */
  lockedReason?: string;
  /** `"value"` keeps a computed fact a value row in an editable form. */
  presentation?: "control" | "value";
  /** The `name` of the control. */
  name?: string;
}

/** Defaults of `FieldProps` for `withDefaults(defineProps<FieldProps & …>(), { ...fieldDefaults, … })`. */
export const fieldDefaults = {
  label: undefined,
  labelHidden: false,
  hint: undefined,
  error: undefined,
  required: false,
  editable: true,
  disabled: false,
  lockedReason: undefined,
  presentation: "control" as const,
  name: undefined,
};

/** The slots every field passes through to its `Field` row (see `Field`). */
export interface FieldSlots {
  /** A custom read-only presentation (a picked record's card) when the value is not enough. */
  readonly?: () => unknown;
  /** A row action after the control (a per-row Save). */
  trailing?: () => unknown;
  /** At the end of the label's line while editing. */
  labelTrailing?: () => unknown;
}

/** How a row lays out: a label column with a control, a label with a trailing control, a label over a full-width control, or a value. */
export type FormRowLayout = "entry" | "setting" | "stacked" | "value";

/** The state a `FormGroup` shares with the rows in it. */
export interface FormGroupContext {
  /** Read-mode rows without a value are not rendered. */
  readonly hideEmpty: ComputedRef<boolean>;
  /** A field says whether it is locked (`disabled` while the form edits), so the group can say why once in its footer. Returns the release. */
  registerLocked(locked: Ref<boolean>): () => void;
  /** A field announces its key and lock, whatever its mode (a record's read page learns which group a field is in). Returns the release. */
  registerField?(field: string | undefined, disabled: Ref<boolean>): () => void;
}

export const formGroupKey: InjectionKey<FormGroupContext> = Symbol("vue-core.formGroup");
export const formRowIndentKey: InjectionKey<number> = Symbol("vue-core.formRowIndent");
/** Whether the form (or group) edits. Provided by `FormView`, `FormGroup :editable` and `RecordGroupScope`; absent means it does. */
export const formEditableKey: InjectionKey<Readonly<Ref<boolean>>> = Symbol("vue-core.formEditable");

/** The group a field sits in, or null for a field on its own. */
export const useFormGroup = (): FormGroupContext | null => inject(formGroupKey, null);
export const useFormRowIndent = (): number => inject(formRowIndentKey, 0);

/**
 * Whether a field edits, reads or is locked. Two separate things:
 *
 * - **Read mode** is the form's (`FormView :editable`, `FormGroup :editable`) or the field's own `editable`: a value row.
 * - **Locked** is the field's `disabled`: it cannot change while the form edits. In a row on desktop it keeps its
 *   control, dimmed; on compact screens, and for a fact (`presentation="value"`), it reads as a value row.
 *
 * The field's row and its control both ask this, so they always agree.
 */
export function useFieldMode(props: { editable?: boolean; disabled?: boolean; presentation?: "control" | "value" }): { editable: ComputedRef<boolean>; locked: ComputedRef<boolean> } {
  const group = useFormGroup();
  const formEditable = inject(formEditableKey, ref(true));
  const compact = useCompactPresentation();
  const lockedAsValue = computed(() => !!group && !!props.disabled && (compact.value || props.presentation === "value"));
  const editable = computed(() => (props.editable ?? true) && formEditable.value && !lockedAsValue.value);
  const locked = computed(() => !!group && !!props.disabled && editable.value);
  if (group) {
    const release = group.registerLocked(computed(() => !!props.disabled && formEditable.value && props.presentation !== "value"));
    onBeforeUnmount(release);
  }
  return { editable, locked };
}

const FIELD_KEYS = ["label", "labelHidden", "hint", "error", "required", "editable", "disabled", "lockedReason", "presentation", "name"] as const;

/** The `FieldProps` part of a control's props, to pass on to its `Field`: `<Field v-bind="fieldProps(props)">`. */
export function fieldProps(props: FieldProps): FieldProps {
  return Object.fromEntries(FIELD_KEYS.map((key) => [key, props[key]])) as FieldProps;
}
