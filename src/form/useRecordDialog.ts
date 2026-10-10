import { shallowRef, type Ref } from "vue";
import { useCommand, type Command } from "./useCommand";
import type { FormOptions, SubmitContext } from "./useForm";

export interface RecordDialogOptions<Values extends object, Output = Values, Done = unknown, Row = never> extends FormOptions<Values, Output> {
  /** A new record: one call with the validator's output. */
  readonly create: (input: Output, context: SubmitContext) => Promise<Done>;
  /** An existing one: the row that was opened, and the output. Leave it out for a dialog that only adds. */
  readonly update?: (row: Row, input: Output, context: SubmitContext) => Promise<Done>;
  /** What the dialog shows for a row, laid over `defaults` (so a field the row lacks shows its default). */
  readonly toValues?: (row: Row) => Partial<Values>;
  /** After the call went through: the page updates itself (reload, toast). `editing` is the row that was saved, `null` for a new record, as it was when the save ran. */
  readonly done?: (result: Done, context: { readonly editing: Row | null }) => Promise<unknown> | unknown;
}

export interface RecordDialog<Values extends object, Output = Values, Done = unknown, Row = never> {
  /** For `<CommandDialog :command="dialog.command">`. */
  readonly command: Command<Values, Output, Done>;
  /** The dialog's inputs (`dialog.form.bind('name')`). */
  readonly form: Command<Values, Output, Done>["form"];
  /** The row being edited, `null` for a new record: the title, the fields that only a new one has, "Save and add another". */
  readonly editing: Readonly<Ref<Row | null>>;
  /** Opens the dialog for a new record, with the defaults. */
  create(): void;
  /** Opens it for `row`: `toValues(row)` over the defaults. */
  edit(row: Row): void;
}

/**
 * A small record that is added and edited in one dialog (an admin list's rows): a `useCommand` whose call is `create` for a new
 * record and `update` for an edited one, chosen by `editing`. The dialog (`CommandDialog`) brings the discard guard, the "saved"
 * beat, field errors and the failure banner; "Save and add another" is `run({ addAnother: true })` in its `#actions`, shown only
 * while `!dialog.editing.value` (it opens a fresh, new one).
 *
 *   const dialog = useRecordDialog({
 *     defaults: () => ({ name: "", active: true }),
 *     validator: categorySchema,
 *     toValues: (category: Category) => ({ name: category.name, active: category.active }),
 *     create: (input, { idempotencyKey }) => api.createCategory(input, idempotencyKey),
 *     update: (category, input, { idempotencyKey }) => api.updateCategory(category.id, input, idempotencyKey),
 *     done: (_result, { editing }) => toast.success(t(editing ? "updated" : "created")),
 *   });
 *   <Button @click="dialog.create()">New</Button>  <Button @click="dialog.edit(row)">Edit</Button>
 *   <CommandDialog :command="dialog.command" :title="dialog.editing.value ? t('edit') : t('new')" :confirm-label="t('save')"><TextField v-bind="dialog.form.bind('name')" /></CommandDialog>
 *
 * A record that must be read first is read by the page, which then calls `edit(record)`.
 */
export function useRecordDialog<Values extends object, Output = Values, Done = unknown, Row = never>(options: RecordDialogOptions<Values, Output, Done, Row>): RecordDialog<Values, Output, Done, Row> {
  const editing = shallowRef<Row | null>(null);
  let saving: Row | null = null; // what the running save is for: `editing` can change before `done` runs
  const command = useCommand<Values, Output, Done>({
    ...options,
    done: options.done ? (result) => options.done?.(result, { editing: saving }) : undefined,
    run(input, context) {
      const row = (saving = editing.value);
      if (row === null) return options.create(input, context);
      if (!options.update) throw new Error("useRecordDialog: edit() needs an `update`.");
      return options.update(row, input, context);
    },
  });
  return {
    command,
    form: command.form,
    editing,
    create() {
      editing.value = null;
      command.present();
    },
    edit(row) {
      editing.value = row;
      command.present(options.toValues?.(row));
    },
  };
}
