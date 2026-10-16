import { shallowRef, type Ref } from "vue";

/** What every picker takes; add the fields your list needs (a record to exclude, a scope). */
export interface PickerOptions {
  /** Overrides the dialog's title for this call. */
  title?: string;
  /** A second line under the title for this call. */
  description?: string;
}

/** The arguments of `pick`: optional when every option is. */
type PickArguments<Options> = Partial<Options> extends Options ? [options?: Options] : [options: Options];

export interface Picker<Row, Options extends PickerOptions = PickerOptions> {
  /** Whether the dialog is open and what it was opened with; read by `PickerModal`. */
  readonly state: Readonly<Ref<{ readonly open: boolean; readonly options: Options | null }>>;
  /**
   * Opens the dialog and resolves with the chosen row, or null when it is dismissed. Picking again
   * while it is open resolves the earlier call with null.
   */
  pick(...options: PickArguments<Options>): Promise<Row | null>;
  /** The choice: resolves `pick` with the row and closes the dialog. */
  select(row: Row): void;
  /** Resolves `pick` with null and closes the dialog. */
  cancel(): void;
}

/**
 * The open, choose and cancel plumbing of a "choose one record" dialog that any screen can ask for
 * and `await`. One picker per kind of record, made once by the app; `PickerModal` is its dialog:
 *
 *   export const userPicker = createPicker<User, { title?: string; locationId?: number }>();
 *
 *   const user = await userPicker.pick({ locationId: 4 });   // User, or null when dismissed
 *
 * Mount `<PickerModal :picker="userPicker">` once where the app keeps its dialogs (a shell `host`
 * contribution) and put a `CollectionTable` with `pick` inside it.
 */
export function createPicker<Row, Options extends PickerOptions = PickerOptions>(): Picker<Row, Options> {
  const state = shallowRef<{ open: boolean; options: Options | null }>({ open: false, options: null });
  let pending: ((row: Row | null) => void) | null = null;

  function settle(row: Row | null) {
    const resolve = pending;
    pending = null;
    state.value = { open: false, options: state.value.options };
    resolve?.(row);
  }

  return {
    state,
    pick(...[options]: PickArguments<Options>) {
      pending?.(null);
      return new Promise<Row | null>((resolve) => {
        pending = resolve;
        state.value = { open: true, options: (options ?? {}) as Options };
      });
    },
    select: (row) => settle(row),
    cancel: () => settle(null),
  };
}
