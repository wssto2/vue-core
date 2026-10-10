import { fireEvent, render, screen, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref, type App } from "vue";
import { ApiError } from "../client";
import { deferred } from "../platform/testing";
import { useResource } from "../resource";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import FormGroup from "./FormGroup.vue";
import FormView from "./FormView.vue";
import GroupSheet from "./GroupSheet.vue";
import { createLeaveGuard, leaveGuardKey } from "./leaveGuard";
import LeaveGuardRoot from "./LeaveGuardRoot.vue";
import { provideRecordGroups } from "./recordGroups";
import RecordGroupScope from "./RecordGroupScope.vue";
import { settle } from "../testing";
import TextField from "./TextField.vue";
import { useGroupSheet } from "./useGroupSheet";
import { useResourceForm } from "./useResourceForm";

interface Customer {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly version: number;
}
interface Values {
  name: string;
  email: string;
  phone: string;
}

const i18n = createTestI18n();
const customer = (over: Partial<Customer> = {}): Customer => ({ id: 1, name: "Ann", email: "ann@x.test", phone: "111", version: 1, ...over });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
});

interface Setup {
  record?: Customer;
  save?: (payload: Values, record: Customer) => Promise<Customer>;
  load?: () => Promise<Customer>;
  dedicated?: (changes: { email: string; phone: string }) => Promise<unknown>;
  onSaved?: () => Promise<unknown> | unknown;
  rebase?: boolean;
  canEdit?: boolean;
}

/** A record page of two groups, read by default, each group edited in its own sheet: the D22 record. */
async function openRecord(setup: Setup = {}) {
  const guard = createLeaveGuard();
  const calls = { load: vi.fn(setup.load ?? (async () => setup.record ?? customer())), save: vi.fn(setup.save ?? (async (payload: Values, record: Customer) => ({ ...record, ...payload, version: record.version + 1 }))) };
  let api!: { form: ReturnType<typeof makeForm>; contact: ReturnType<typeof makeContact>; general: ReturnType<typeof makeGeneral>; customer: ReturnType<typeof makeSource> };
  const makeSource = () => useResource<Customer>({ for: ref(1), load: () => calls.load() });
  const makeForm = (source: ReturnType<typeof makeSource>) =>
    useResourceForm({
      source,
      defaults: (): Values => ({ name: "", email: "", phone: "" }),
      validator: {
        safeParse: (input) => {
          const value = input as Values;
          const issues = [...(value.name.trim() ? [] : [{ path: ["name"], message: "Name is required" }]), ...(value.email.includes("@") ? [] : [{ path: ["email"], message: "Not an e-mail" }])];
          return issues.length ? { success: false, error: { issues } } : { success: true, data: value };
        },
      },
      toValues: (record): Values => ({ name: record.name, email: record.email, phone: record.phone }),
      save: (payload, record) => calls.save(payload, record),
    });
  const makeContact = (form: ReturnType<typeof makeForm>, groups: ReturnType<typeof provideRecordGroups<"general" | "contact">>, source: ReturnType<typeof makeSource>) =>
    useGroupSheet({
      form,
      group: "contact",
      fields: ["email", "phone"],
      groupOf: groups.groupOf,
      save: setup.dedicated,
      onSaved: setup.onSaved,
      rebase: setup.rebase ? { reload: () => source.reload(), message: () => "The customer changed. Check your edits and save again." } : undefined,
    });
  const makeGeneral = (form: ReturnType<typeof makeForm>, groups: ReturnType<typeof provideRecordGroups<"general" | "contact">>) => useGroupSheet({ form, group: "general", fields: ["name"], groupOf: groups.groupOf });

  const Sections = defineComponent({
    props: { form: { type: Object, required: true } },
    setup(props) {
      const form = props.form as ReturnType<typeof makeForm>;
      return () => [
        h(FormGroup, { header: "General", group: "general" }, () => h(TextField, { ...form.bind("name"), label: "Name" })),
        h(FormGroup, { header: "Contact", group: "contact" }, () => [h(TextField, { ...form.bind("email"), label: "Email" }), h(TextField, { ...form.bind("phone"), label: "Phone" })]),
      ];
    },
  });
  const Host = defineComponent({
    setup() {
      const source = makeSource();
      const form = makeForm(source);
      const sheets: Record<string, { present: () => void }> = {};
      const groups = provideRecordGroups<"general" | "contact">({ edit: (group) => (setup.canEdit === false ? null : sheets[group]!.present) });
      const contact = makeContact(form, groups, source);
      const general = makeGeneral(form, groups);
      sheets.contact = contact;
      sheets.general = general;
      api = { form, contact, general, customer: source };
      const label = (group: string) => (group === "general" ? "General" : "Contact");
      return () =>
        source.data.value
          ? h("div", [
              h(FormView, { form, editable: false }, () => h(Sections, { form })),
              h(GroupSheet, { sheet: contact, title: "Contact", editable: setup.canEdit !== false, groupLabel: label }, () => h(RecordGroupScope, { only: "contact", editable: setup.canEdit !== false }, () => h(Sections, { form }))),
              h(GroupSheet, { sheet: general, title: "General", editable: setup.canEdit !== false, groupLabel: label }, () => h(RecordGroupScope, { only: "general", editable: setup.canEdit !== false }, () => h(Sections, { form }))),
              h(LeaveGuardRoot),
            ])
          : h("p", "loading");
    },
  });
  const view = render(Host, { global: { plugins: [i18n, testFormatting(i18n), { install: (app: App) => app.provide(leaveGuardKey, guard) }], stubs: { transition: false } } });
  await settle();
  return { ...view, ...api, calls, guard };
}

const editButton = (group: "General" | "Contact") => {
  const header = screen.getAllByRole("heading", { level: 3 }).find((each) => each.textContent?.trim() === group)!;
  return within(header.parentElement!).getByRole("button", { name: "Edit" });
};
const sheet = () => screen.getByRole("dialog", { hidden: true });
const inSheet = () => within(sheet());
const save = async () => {
  await fireEvent.click(inSheet().getByRole("button", { name: /^Save/ }));
  await settle();
};

describe("a record of groups, read where it reads", () => {
  it("reads every group, and each one that can change has its own Edit", async () => {
    const { container } = await openRecord();
    expect(container.querySelector("input")).toBeNull();
    expect(container.textContent).toContain("ann@x.test");
    expect(editButton("General")).toBeTruthy();
    expect(editButton("Contact")).toBeTruthy();
  });

  it("names the group on the group alone, so a spec finds the group's Edit by group", async () => {
    const { container } = await openRecord();
    expect(container.querySelectorAll("[data-test=form-group]")).toHaveLength(2);
    expect(container.querySelectorAll("[data-group=contact]")).toHaveLength(1); // the section only, not its Edit
    expect(container.querySelector("[data-group=contact]")!.matches("[data-test=form-group]")).toBe(true);
    const edit = container.querySelector("[data-group=contact] [data-test=group-edit]")!;
    expect(edit.hasAttribute("data-group")).toBe(false);
    expect(container.querySelector("[data-group=general] [data-test=group-edit]")).not.toBe(edit);
    await fireEvent.click(edit);
    await settle();
    expect(inSheet().getByLabelText("Email")).toBeTruthy(); // the Edit found by group opens that group's sheet
  });

  it("offers no Edit for a group the viewer may not change", async () => {
    await openRecord({ canEdit: false });
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("hydrates from the route's record once, with no request of its own", async () => {
    const { calls, form } = await openRecord();
    expect(calls.load).toHaveBeenCalledTimes(1);
    expect(form.values.email).toBe("ann@x.test");
  });

  it("opens a sheet with that group alone", async () => {
    await openRecord();
    await fireEvent.click(editButton("Contact"));
    await settle();
    expect(inSheet().getByLabelText("Email")).toBeTruthy();
    expect(inSheet().getByLabelText("Phone")).toBeTruthy();
    expect(inSheet().queryByLabelText("Name")).toBeNull();
  });
});

describe("saving one group: the record's full update", () => {
  it("sends the whole valid record with the group's changes, updates the resource once, and closes the sheet", async () => {
    const onSaved = vi.fn();
    const { calls, form, customer: source } = await openRecord({ onSaved });
    await fireEvent.click(editButton("Contact"));
    await settle();
    await fireEvent.update(inSheet().getByLabelText("Email"), "new@x.test");
    await save();
    expect(calls.save).toHaveBeenCalledTimes(1);
    expect(calls.save.mock.calls[0]?.[0]).toEqual({ name: "Ann", email: "new@x.test", phone: "111" });
    expect(source.data.value).toMatchObject({ email: "new@x.test", version: 2 });
    expect(calls.load).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(form.dirty.value).toBe(false);
    await sleep(700);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("new@x.test")).toBeTruthy();
  });

  it("collapses a double click on Save into one request", async () => {
    const gate = deferred<Customer>();
    const { calls } = await openRecord({ save: () => gate.promise });
    await fireEvent.click(editButton("Contact"));
    await settle();
    await fireEvent.update(inSheet().getByLabelText("Email"), "new@x.test");
    await fireEvent.click(inSheet().getByRole("button", { name: /^Save/ }));
    await fireEvent.click(inSheet().getByRole("button", { name: /^Sav/ }));
    expect(calls.save).toHaveBeenCalledTimes(1);
    gate.resolve(customer({ email: "new@x.test", version: 2 }));
    await settle();
  });

  it("a failed save keeps the draft, the sheet open and the record as it was", async () => {
    const { form, customer: source } = await openRecord({
      save: async () => {
        throw new ApiError({ kind: "server", message: "boom", status: 500, requestId: "req-9" });
      },
    });
    await fireEvent.click(editButton("Contact"));
    await settle();
    await fireEvent.update(inSheet().getByLabelText("Email"), "new@x.test");
    await save();
    expect(form.values.email).toBe("new@x.test");
    expect(form.dirty.value).toBe(true);
    expect(source.data.value?.email).toBe("ann@x.test");
    expect(inSheet().getByText(/could not be saved/)).toBeTruthy();
    expect(inSheet().getByText(/req-9/)).toBeTruthy();
  });

  it("puts a server field error on the field in the sheet", async () => {
    await openRecord({
      save: async () => {
        throw new ApiError({ kind: "validation", message: "no", status: 422, fields: { email: ["already used"] } });
      },
    });
    await fireEvent.click(editButton("Contact"));
    await settle();
    await fireEvent.update(inSheet().getByLabelText("Email"), "dup@x.test");
    await save();
    expect(inSheet().getByText("already used")).toBeTruthy();
  });
});

describe("foreign-field errors", () => {
  it("names the group whose data the save needs, when the record is invalid elsewhere", async () => {
    const { form } = await openRecord({ record: customer({ name: "" }) });
    await fireEvent.click(editButton("Contact"));
    await settle();
    await fireEvent.update(inSheet().getByLabelText("Email"), "new@x.test");
    await save();
    expect(document.querySelector("[data-test='group-sheet-foreign']")?.textContent).toContain("General");
    // the error itself stays in the form, for the group's own sheet
    expect(form.errors.first("name")).toBe("Name is required");
  });

  it("names the group for a server error on another group's field, too", async () => {
    const { form } = await openRecord({
      save: async () => {
        throw new ApiError({ kind: "validation", message: "no", status: 422, fields: { name: ["taken"] } });
      },
    });
    await fireEvent.click(editButton("Contact"));
    await settle();
    await fireEvent.update(inSheet().getByLabelText("Email"), "new@x.test");
    await save();
    expect(document.querySelector("[data-test='group-sheet-foreign']")?.textContent).toContain("General");
    expect(form.errors.first("name")).toBe("taken");
  });

  it("lists an error on a field no group claims instead of dropping it", async () => {
    await openRecord({
      save: async () => {
        throw new ApiError({ kind: "validation", message: "no", status: 422, fields: { "vat_id": ["invalid"] } });
      },
    });
    await fireEvent.click(editButton("Contact"));
    await settle();
    await fireEvent.update(inSheet().getByLabelText("Email"), "new@x.test");
    await save();
    expect(inSheet().getByText(/vat_id/)).toBeTruthy();
    expect(document.querySelector("[data-test='group-sheet-foreign']")).toBeNull();
  });
});

describe("cancel and discard", () => {
  it("Cancel of an untouched sheet just closes it", async () => {
    await openRecord();
    await fireEvent.click(editButton("Contact"));
    await settle();
    await fireEvent.click(inSheet().getByRole("button", { name: "Cancel" }));
    await settle();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("returns focus to the group's Edit when the sheet closes", async () => {
    await openRecord();
    const edit = editButton("Contact");
    edit.focus();
    await fireEvent.click(edit);
    await settle();
    expect(sheet().contains(document.activeElement)).toBe(true);
    await fireEvent.click(inSheet().getByRole("button", { name: "Cancel" }));
    await settle();
    expect(document.activeElement).toBe(edit);
  });

  it("Cancel with edits asks first; Discard puts the group's values back", async () => {
    const { form } = await openRecord();
    await fireEvent.click(editButton("Contact"));
    await settle();
    await fireEvent.update(inSheet().getByLabelText("Email"), "typed@x.test");
    await fireEvent.click(inSheet().getByRole("button", { name: "Cancel" }));
    await settle();
    expect(screen.getByRole("alertdialog").textContent).toContain("Unsaved changes");
    await fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await settle();
    expect(form.values.email).toBe("ann@x.test");
    expect(form.dirty.value).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Continue editing keeps the sheet and what was typed", async () => {
    const { form } = await openRecord();
    await fireEvent.click(editButton("Contact"));
    await settle();
    await fireEvent.update(inSheet().getByLabelText("Email"), "typed@x.test");
    await fireEvent.click(inSheet().getByRole("button", { name: "Cancel" }));
    await settle();
    await fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));
    await settle();
    expect(form.values.email).toBe("typed@x.test");
    expect(sheet()).toBeTruthy();
  });

  it("only the group's fields are restored: another group's draft is not touched by this sheet's Cancel", async () => {
    const { form } = await openRecord();
    form.values.name = "Edited elsewhere";
    await fireEvent.click(editButton("Contact"));
    await settle();
    await fireEvent.update(inSheet().getByLabelText("Email"), "typed@x.test");
    await fireEvent.click(inSheet().getByRole("button", { name: "Cancel" }));
    await settle();
    await fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await settle();
    expect(form.values.name).toBe("Edited elsewhere");
    expect(form.values.email).toBe("ann@x.test");
  });

  it("clears the group's leftover errors on Cancel", async () => {
    const { form } = await openRecord();
    await fireEvent.click(editButton("Contact"));
    await settle();
    form.errors.set({ email: ["old"], phone: ["old too"] });
    await fireEvent.click(inSheet().getByRole("button", { name: "Cancel" }));
    await settle();
    expect(form.errors.count.value).toBe(0);
  });
});

describe("a stale save (409)", () => {
  const conflict = () => new ApiError({ kind: "conflict", message: "stale", status: 409 });

  it("is shown as the conflict it is, and nothing is reloaded or retried, when the endpoint has no stale-record contract", async () => {
    const { calls, form } = await openRecord({
      save: async () => {
        throw conflict();
      },
    });
    await fireEvent.click(editButton("Contact"));
    await settle();
    await fireEvent.update(inSheet().getByLabelText("Email"), "mine@x.test");
    await save();
    expect(calls.load).toHaveBeenCalledTimes(1);
    expect(calls.save).toHaveBeenCalledTimes(1);
    expect(inSheet().getByText(/changed while you were editing/)).toBeTruthy();
    expect(form.values.email).toBe("mine@x.test");
  });

  it("is rebased where enabled: the record is read again, the user's edits go back on top of it, and a deliberate second Save sends them", async () => {
    let first = true;
    let stored = customer();
    const { calls, form } = await openRecord({
      rebase: true,
      load: async () => stored,
      save: async (payload, record) => {
        if (first) {
          first = false;
          stored = customer({ name: "Renamed by someone", phone: "999", version: 2 }); // the record moved on
          throw conflict();
        }
        return { ...record, ...payload, version: record.version + 1 };
      },
    });
    await fireEvent.click(editButton("Contact"));
    await settle();
    await fireEvent.update(inSheet().getByLabelText("Email"), "mine@x.test");
    await save();
    expect(calls.save).toHaveBeenCalledTimes(1); // not retried by itself
    expect(calls.load).toHaveBeenCalledTimes(2);
    expect(form.values.email).toBe("mine@x.test"); // my edit kept
    expect(form.values.phone).toBe("999"); // what I did not edit is the new record's
    expect(form.values.name).toBe("Renamed by someone"); // the other groups follow the new record, nothing of theirs is overwritten
    expect(document.querySelector("[data-test='group-sheet-notice']")?.textContent).toContain("The customer changed");
    expect(form.dirty.value).toBe(true);
    await save();
    expect(calls.save).toHaveBeenCalledTimes(2);
    expect(calls.save.mock.calls[1]?.[0]).toEqual({ name: "Renamed by someone", email: "mine@x.test", phone: "999" });
  });

  it("Cancel after a rebase puts back the new record's values, not the stale ones", async () => {
    let stored = customer();
    const { form } = await openRecord({
      rebase: true,
      load: async () => stored,
      save: async () => {
        stored = customer({ phone: "999", version: 2 });
        throw conflict();
      },
    });
    await fireEvent.click(editButton("Contact"));
    await settle();
    await fireEvent.update(inSheet().getByLabelText("Email"), "mine@x.test");
    await save();
    await fireEvent.click(inSheet().getByRole("button", { name: "Cancel" }));
    await settle();
    await fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await settle();
    expect(form.values.email).toBe("ann@x.test");
    expect(form.values.phone).toBe("999");
  });

  it("keeps the conflict and the draft when the record cannot be read again", async () => {
    let reads = 0;
    const { form } = await openRecord({
      rebase: true,
      load: async () => {
        if (++reads > 1) throw new ApiError({ kind: "network", message: "off" });
        return customer();
      },
      save: async () => {
        throw conflict();
      },
    });
    await fireEvent.click(editButton("Contact"));
    await settle();
    await fireEvent.update(inSheet().getByLabelText("Email"), "mine@x.test");
    await save();
    expect(form.values.email).toBe("mine@x.test");
    expect(inSheet().getByText(/changed while you were editing/)).toBeTruthy();
  });
});

describe("a group with an endpoint of its own", () => {
  it("sends only the group's fields to it, never the record's update, and refreshes the record after", async () => {
    const dedicated = vi.fn(async (_changes: { email: string; phone: string }) => ({ ok: true }));
    const onSaved = vi.fn();
    const { calls, form } = await openRecord({ dedicated, onSaved });
    form.values.name = ""; // invalid for the whole record, but not this group's business
    await fireEvent.click(editButton("Contact"));
    await settle();
    await fireEvent.update(inSheet().getByLabelText("Email"), "new@x.test");
    await save();
    expect(dedicated).toHaveBeenCalledWith({ email: "new@x.test", phone: "111" }, expect.anything());
    expect(calls.save).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("closes after a save whose refresh failed, and tells the record could not be read", async () => {
    await openRecord({
      dedicated: async () => ({ ok: true }),
      onSaved: async () => {
        throw new ApiError({ kind: "server", message: "boom", status: 500 });
      },
    });
    await fireEvent.click(editButton("Contact"));
    await settle();
    await fireEvent.update(inSheet().getByLabelText("Email"), "new@x.test");
    await save();
    await sleep(700);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("a read-only sheet", () => {
  it("has no Save and reads its group: a viewer without the right can still see what the group holds", async () => {
    const { contact } = await openRecord({ canEdit: false });
    contact.present();
    await settle();
    expect(inSheet().queryByRole("button", { name: /^Save/ })).toBeNull();
    expect(inSheet().queryByRole("textbox")).toBeNull();
    expect(inSheet().getByText("ann@x.test")).toBeTruthy();
    expect(inSheet().getAllByRole("button", { name: "Close" }).length).toBeGreaterThan(0);
  });
});
