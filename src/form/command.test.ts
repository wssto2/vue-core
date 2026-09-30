import { fireEvent, render, screen, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref, type App, type Component } from "vue";
import { ApiError } from "../client";
import AlertDialog from "../overlay/AlertDialog.vue";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import CommandDialog from "./CommandDialog.vue";
import FormGroup from "./FormGroup.vue";
import { createLeaveGuard, leaveGuardKey } from "./leaveGuard";
import LeaveGuardRoot from "./LeaveGuardRoot.vue";
import SelectField from "./SelectField.vue";
import { settle } from "./testing";
import TextField from "./TextField.vue";
import { useCommand } from "./useCommand";

const i18n = createTestI18n("en");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
});

const people = [
  { value: 1, label: "Ann" },
  { value: 2, label: "Bob" },
] as const;

function mountAssign(run: (input: { assignee: number; note: string }) => Promise<unknown> = async () => ({ ok: true }), done?: () => unknown) {
  const guard = createLeaveGuard();
  let command!: ReturnType<typeof makeCommand>;
  const makeCommand = () =>
    useCommand({
      defaults: () => ({ assignee: null as number | null, note: "" }),
      validator: {
        safeParse: (input) => ((input as { assignee: number | null }).assignee === null ? { success: false, error: { issues: [{ path: ["assignee"], message: "Choose an assignee" }] } } : { success: true, data: input as { assignee: number; note: string } }),
      },
      run: (input) => run(input),
      done,
    });
  const Host = defineComponent({
    setup() {
      command = makeCommand();
      return () =>
        h("div", [
          h("button", { onClick: () => command.present() }, "Assign…"),
          h(CommandDialog, { command, title: "Assign ticket", confirmLabel: "Assign", message: "Who takes this ticket?" }, () =>
            h(FormGroup, null, () => [h(SelectField as Component, { ...command.form.bind("assignee"), label: "Assignee", options: people }), h(TextField, { ...command.form.bind("note"), label: "Note" })]),
          ),
          h(LeaveGuardRoot),
        ]);
    },
  });
  const view = render(Host, { global: { plugins: [i18n, testFormatting(i18n), { install: (app: App) => app.provide(leaveGuardKey, guard) }], stubs: { transition: false } } });
  return { ...view, command: () => command };
}
const dialog = () => within(document.querySelector("[data-presentation]") as HTMLElement);
const open = async () => {
  await fireEvent.click(screen.getByRole("button", { name: "Assign…" }));
  await settle();
};
const pickAssignee = async (name: string) => {
  await fireEvent.click(dialog().getAllByLabelText("Assignee")[0]!);
  await settle();
  const listbox = screen.getAllByRole("dialog").find((each) => each.getAttribute("aria-label") === "Assignee")!;
  await fireEvent.click(within(listbox).getByRole("option", { name }).querySelector("button")!);
};

describe("a command dialog", () => {
  it("opens with its message and inputs and one primary action that says what it does", async () => {
    mountAssign();
    await open();
    expect(dialog().getByText("Who takes this ticket?")).toBeTruthy();
    expect(dialog().getByRole("button", { name: "Assign" })).toBeTruthy();
    expect(dialog().getByLabelText("Note")).toBeTruthy();
  });

  it("calls its endpoint with the validated input, tells the page, says done, and closes", async () => {
    const run = vi.fn(async (_input: { assignee: number; note: string }) => ({ ok: true }));
    const done = vi.fn();
    const { command } = mountAssign(run, done);
    await open();
    await pickAssignee("Bob");
    await fireEvent.update(dialog().getByLabelText("Note"), "Urgent");
    await fireEvent.click(dialog().getByRole("button", { name: "Assign" }));
    await settle();
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0]?.[0]).toEqual({ assignee: 2, note: "Urgent" });
    expect(done).toHaveBeenCalledTimes(1);
    expect(dialog().getByRole("button", { name: "Saved" })).toBeTruthy();
    await sleep(700);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(command().open.value).toBe(false);
  });

  it("shows a refused input on its field and focuses it; nothing is called", async () => {
    const run = vi.fn(async () => ({}));
    mountAssign(run);
    await open();
    await fireEvent.click(dialog().getByRole("button", { name: "Assign" }));
    await settle();
    expect(run).not.toHaveBeenCalled();
    expect(dialog().getByText("Choose an assignee")).toBeTruthy();
    expect(document.activeElement).toBe(dialog().getAllByLabelText("Assignee")[0]);
  });

  it("puts the server's field errors on the fields and keeps the input", async () => {
    mountAssign(async () => {
      throw new ApiError({ kind: "validation", message: "no", status: 422, fields: { note: ["too long for a note"] } });
    });
    await open();
    await pickAssignee("Ann");
    await fireEvent.update(dialog().getByLabelText("Note"), "x");
    await fireEvent.click(dialog().getByRole("button", { name: "Assign" }));
    await settle();
    expect(dialog().getByText("too long for a note")).toBeTruthy();
    expect((dialog().getByLabelText("Note") as HTMLInputElement).value).toBe("x");
    expect(document.querySelector("[data-presentation]")).not.toBeNull();
  });

  it("says a conflict is a conflict (the workflow moved on) and does not retry", async () => {
    const run = vi.fn(async () => {
      throw new ApiError({ kind: "conflict", message: "already assigned", status: 409 });
    });
    mountAssign(run);
    await open();
    await pickAssignee("Ann");
    await fireEvent.click(dialog().getByRole("button", { name: "Assign" }));
    await settle();
    expect(dialog().getByText(/changed while you were editing/)).toBeTruthy();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("starts every time from fresh input, and from what the caller already knows", async () => {
    const { command } = mountAssign();
    await open();
    await fireEvent.update(dialog().getByLabelText("Note"), "left over");
    command().dismiss();
    await settle();
    command().present({ assignee: 1 });
    await settle();
    expect((dialog().getByLabelText("Note") as HTMLInputElement).value).toBe("");
    expect(command().form.values.assignee).toBe(1);
  });

  it("asks before closing with input that was typed", async () => {
    mountAssign();
    await open();
    await fireEvent.update(dialog().getByLabelText("Note"), "typed");
    await fireEvent.click(dialog().getByRole("button", { name: "Cancel" }));
    await settle();
    expect(screen.getByRole("alertdialog").textContent).toContain("Unsaved changes");
    await fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes an untouched dialog without asking", async () => {
    mountAssign();
    await open();
    await fireEvent.click(dialog().getByRole("button", { name: "Cancel" }));
    await settle();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("a command with nothing to enter", () => {
  function mountClose(run: () => Promise<unknown>) {
    const confirmed = vi.fn();
    const failed = vi.fn();
    const alert = ref<{ present: () => void } | null>(null);
    const Host = defineComponent({
      setup() {
        const command = useCommand({ defaults: () => ({}) as Record<string, never>, run });
        return () =>
          h("div", [
            h("button", { onClick: () => alert.value?.present() }, "Close ticket"),
            h(AlertDialog, { ref: alert, title: "Close this ticket?", confirmLabel: "Close it", action: command.confirm, onConfirm: confirmed, onFailed: failed }),
          ]);
      },
    });
    render(Host, { global: { plugins: [i18n], stubs: { transition: false } } });
    return { confirmed, failed };
  }

  it("is an AlertDialog whose action is the command: it closes when the call went through", async () => {
    const run = vi.fn(async () => ({ ok: true }));
    const { confirmed } = mountClose(run);
    await fireEvent.click(screen.getByRole("button", { name: "Close ticket" }));
    await settle();
    await fireEvent.click(screen.getByRole("button", { name: "Close it" }));
    await settle();
    expect(run).toHaveBeenCalledTimes(1);
    expect(confirmed).toHaveBeenCalledTimes(1);
  });

  it("stays open and says it failed when the call did not go through", async () => {
    const { confirmed, failed } = mountClose(async () => {
      throw new ApiError({ kind: "forbidden", message: "no", status: 403 });
    });
    await fireEvent.click(screen.getByRole("button", { name: "Close ticket" }));
    await settle();
    await fireEvent.click(screen.getByRole("button", { name: "Close it" }));
    await settle();
    expect(confirmed).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledTimes(1);
    expect((failed.mock.calls[0]?.[0] as Error).message).toContain("permission");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });
});
