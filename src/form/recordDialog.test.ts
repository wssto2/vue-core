import { fireEvent, render, screen, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, type App } from "vue";
import { Button } from "../button";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import { settle } from "../testing";
import CommandDialog from "./CommandDialog.vue";
import FormGroup from "./FormGroup.vue";
import { createLeaveGuard, leaveGuardKey } from "./leaveGuard";
import LeaveGuardRoot from "./LeaveGuardRoot.vue";
import TextField from "./TextField.vue";
import { useRecordDialog } from "./useRecordDialog";

const i18n = createTestI18n();
afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
});

interface Category {
  readonly id: number;
  readonly name: string;
  readonly note: string | null;
}
const row: Category = { id: 7, name: "Cars", note: "kept" };

function mountList(create = vi.fn(async (..._args: unknown[]) => ({})), update = vi.fn(async (..._args: unknown[]) => ({})), refuse = false, done?: (editing: Category | null) => void) {
  let dialog!: ReturnType<typeof make>;
  const make = () =>
    useRecordDialog({
      defaults: () => ({ name: "", note: "default note" }),
      validator: { safeParse: (input) => (refuse && (input as { name: string }).name === "" ? { success: false, error: { issues: [{ path: ["name"], message: "Enter a name." }] } } : { success: true, data: input as { name: string; note: string } }) },
      toValues: (category: Category) => ({ name: category.name, ...(category.note === null ? {} : { note: category.note }) }),
      create,
      done: (_result, { editing }) => done?.(editing),
      update: (category: Category, input, context) => update(category.id, input, context.idempotencyKey),
    });
  const Host = defineComponent({
    setup() {
      dialog = make();
      return () =>
        h("div", [
          h(Button, { onClick: () => dialog.create() }, () => "New"),
          h(Button, { onClick: () => dialog.edit(row) }, () => "Edit"),
          h(CommandDialog, { command: dialog.command, title: dialog.editing.value ? "Edit category" : "New category", confirmLabel: "Save" }, {
            default: () => h(FormGroup, null, () => [h(TextField, { ...dialog.command.form.bind("name"), label: "Name" }), h(TextField, { ...dialog.command.form.bind("note"), label: "Note" })]),
            actions: dialog.editing.value ? undefined : ({ run }: { run: (o?: { addAnother?: boolean }) => Promise<void> }) => h(Button, { onClick: () => void run({ addAnother: true }) }, () => "Save and add another"),
          }),
          h(LeaveGuardRoot),
        ]);
    },
  });
  const guard = createLeaveGuard();
  render(Host, { global: { plugins: [i18n, testFormatting(i18n), { install: (app: App) => app.provide(leaveGuardKey, guard) }], stubs: { transition: false } } });
  return { dialog: () => dialog, create, update };
}
const panel = () => within(document.querySelector("[data-presentation]") as HTMLElement);
const typeName = async (text: string) => fireEvent.update(panel().getByLabelText("Name"), text);

describe("useRecordDialog", () => {
  it("create() shows the defaults and a new title, and a save calls create", async () => {
    const { create, update } = mountList();
    await fireEvent.click(screen.getByRole("button", { name: "New" }));
    expect(panel().getByText("New category")).toBeTruthy();
    expect((panel().getByLabelText("Note") as HTMLInputElement).value).toBe("default note");
    await typeName("Boats");
    await fireEvent.click(panel().getByRole("button", { name: "Save" }));
    await settle();
    expect(create).toHaveBeenCalledWith({ name: "Boats", note: "default note" }, expect.objectContaining({ idempotencyKey: expect.any(String) }));
    expect(update).not.toHaveBeenCalled();
  });

  it("edit(row) shows the row over the defaults, editing is the row, and a save calls update with the row", async () => {
    const { dialog, create, update } = mountList();
    await fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(dialog().editing.value).toBe(row);
    expect(panel().getByText("Edit category")).toBeTruthy();
    expect((panel().getByLabelText("Name") as HTMLInputElement).value).toBe("Cars");
    await typeName("Vans");
    await fireEvent.click(panel().getByRole("button", { name: "Save" }));
    await settle();
    expect(update).toHaveBeenCalledWith(7, { name: "Vans", note: "kept" }, expect.any(String));
    expect(create).not.toHaveBeenCalled();
  });

  it("a field the row lacks shows its default, never what the last dialog left", async () => {
    const { dialog } = mountList();
    dialog().edit({ id: 1, name: "Old", note: null });
    await settle();
    expect((panel().getByLabelText("Note") as HTMLInputElement).value).toBe("default note");
    dialog().command.dismiss();
    dialog().create();
    await settle();
    expect(dialog().editing.value).toBeNull();
    expect((panel().getByLabelText("Name") as HTMLInputElement).value).toBe("");
  });

  it("offers Save and add another only for a new record, and it saves then opens a fresh new one", async () => {
    const { dialog, create } = mountList();
    await fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(panel().queryByRole("button", { name: "Save and add another" })).toBeNull();
    dialog().command.dismiss();
    await settle();
    await fireEvent.click(screen.getByRole("button", { name: "New" }));
    await typeName("Boats");
    await fireEvent.click(panel().getByRole("button", { name: "Save and add another" }));
    await settle();
    expect(create).toHaveBeenCalledTimes(1);
    expect(dialog().command.open.value).toBe(true);
    expect((panel().getByLabelText("Name") as HTMLInputElement).value).toBe("");
  });

  it("done is told which row was saved: null for a new record, the row for an edit", async () => {
    const done = vi.fn();
    const { dialog } = mountList(undefined, undefined, false, done);
    await fireEvent.click(screen.getByRole("button", { name: "New" }));
    await typeName("Boats");
    await fireEvent.click(panel().getByRole("button", { name: "Save and add another" }));
    await settle();
    expect(done).toHaveBeenLastCalledWith(null);
    dialog().command.dismiss();
    await settle();
    await fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await typeName("Vans");
    await fireEvent.click(panel().getByRole("button", { name: "Save" }));
    await settle();
    expect(done).toHaveBeenLastCalledWith(row);
  });

  it("a refused save calls nothing and keeps the input", async () => {
    const { create, update } = mountList(undefined, undefined, true);
    await fireEvent.click(screen.getByRole("button", { name: "New" }));
    await fireEvent.update(panel().getByLabelText("Note"), "typed");
    await fireEvent.click(panel().getByRole("button", { name: "Save" }));
    await settle();
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(panel().getByText("Enter a name.")).toBeTruthy();
    expect((panel().getByLabelText("Note") as HTMLInputElement).value).toBe("typed");
  });
});
