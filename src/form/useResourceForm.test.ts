import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { ApiError } from "../client";
import { deferred } from "../platform/testing";
import { useResource } from "../resource";
import { settle, withSetup } from "../testing";
import { useResourceForm } from "./useResourceForm";

interface Ticket {
  readonly id: number;
  readonly subject: string;
  readonly due_on: string | null;
  readonly version: number;
}
interface Values {
  subject: string;
  dueOn: string | null;
}
const ticket = (id: number, subject = `Ticket ${id}`, version = 1): Ticket => ({ id, subject, due_on: null, version });

function page(options: { load?: (id: number) => Promise<Ticket>; save?: (payload: { subject: string }, record: Ticket) => Promise<Ticket>; id?: number } = {}) {
  const id = ref(options.id ?? 1);
  const load = vi.fn(options.load ?? (async (value: number) => ticket(value)));
  const save = vi.fn(options.save ?? (async (payload: { subject: string }, record: Ticket) => ({ ...record, subject: payload.subject, version: record.version + 1 })));
  const setup = withSetup(() => {
    const source = useResource<Ticket>({ for: id, load: (value) => load(value) });
    const form = useResourceForm({
      source,
      defaults: (): Values => ({ subject: "", dueOn: null }),
      toValues: (record): Values => ({ subject: record.subject, dueOn: record.due_on }),
      validator: {
        safeParse: (input) => ((input as Values).subject ? { success: true, data: { subject: (input as Values).subject } } : { success: false, error: { issues: [{ path: ["subject"], message: "Required" }] } }),
      },
      save: (payload, record) => save(payload, record),
    });
    return { source, form };
  });
  return { ...setup.result, id, load, save };
}

describe("useResourceForm: the record is owned once", () => {
  it("fills the form from the record the page loaded, without a request of its own", async () => {
    const { form, load } = page();
    await settle();
    expect(form.values.subject).toBe("Ticket 1");
    expect(form.dirty.value).toBe(false);
    expect(form.record.value).toEqual(ticket(1));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("is filled at once when the record was already there", async () => {
    const { source, id } = page();
    await settle();
    expect(source.data.value?.id).toBe(1);
    expect(id.value).toBe(1);
  });

  it("takes a background reload of the same record while the form is untouched", async () => {
    let subject = "Ticket 1";
    const { form, source } = page({ load: async (value) => ticket(value, subject) });
    await settle();
    subject = "Renamed elsewhere";
    await source.reload();
    expect(form.values.subject).toBe("Renamed elsewhere");
    expect(form.outdated.value).toBe(false);
  });

  it("does not discard edits when the record changes under them: the draft stays, the form is outdated, reset takes the new record", async () => {
    let subject = "Ticket 1";
    const { form, source } = page({ load: async (value) => ticket(value, subject) });
    await settle();
    form.values.subject = "my edit";
    subject = "Renamed elsewhere";
    await source.reload();
    expect(form.values.subject).toBe("my edit");
    expect(form.outdated.value).toBe(true);
    form.reset();
    expect(form.values.subject).toBe("Renamed elsewhere");
    expect(form.outdated.value).toBe(false);
    expect(form.dirty.value).toBe(false);
  });

  it("takes another record when the page moves on to it, edits or not (the leave guard already asked)", async () => {
    const { form, id } = page();
    await settle();
    form.values.subject = "unsaved";
    id.value = 2;
    await settle();
    expect(form.values.subject).toBe("Ticket 2");
    expect(form.dirty.value).toBe(false);
  });
});

describe("useResourceForm: save", () => {
  it("saves the whole record's update and puts what came back in the resource once, with no further request", async () => {
    const { form, source, save, load } = page();
    await settle();
    form.values.subject = "Fixed";
    const result = await form.save();
    expect(result.status).toBe("saved");
    expect(save).toHaveBeenCalledWith({ subject: "Fixed" }, ticket(1));
    expect(source.data.value).toMatchObject({ subject: "Fixed", version: 2 });
    expect(form.record.value?.version).toBe(2);
    expect(form.dirty.value).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("takes the record as the server stored it, not the draft (the server may normalize)", async () => {
    const { form } = page({ save: async (_payload, record) => ({ ...record, subject: "Normalized" }) });
    await settle();
    form.values.subject = "  messy ";
    await form.save();
    expect(form.values.subject).toBe("Normalized");
    expect(form.dirty.value).toBe(false);
  });

  it("a failed save keeps the draft and the record", async () => {
    const { form, source } = page({
      save: async () => {
        throw new ApiError({ kind: "server", message: "x", status: 500 });
      },
    });
    await settle();
    form.values.subject = "Keep me";
    const result = await form.save();
    expect(result.status).toBe("failed");
    expect(form.values.subject).toBe("Keep me");
    expect(form.dirty.value).toBe(true);
    expect(source.data.value?.subject).toBe("Ticket 1");
  });

  it("a save that finishes after the user moved on to another record does not touch that record's form", async () => {
    const gate = deferred<Ticket>();
    const { form, id, source } = page({ save: () => gate.promise });
    await settle();
    form.values.subject = "Edit of one";
    const pending = form.save();
    id.value = 2;
    await settle();
    gate.resolve({ ...ticket(1), subject: "Saved one", version: 2 });
    await pending;
    expect(source.data.value?.id).toBe(2);
    expect(form.values.subject).toBe("Ticket 2");
    expect(form.record.value?.id).toBe(2);
  });

  it("distinguishes a save that worked from a refresh that failed", async () => {
    const { form, save } = page();
    await settle();
    form.values.subject = "Changed";
    const result = await form.save({
      refresh: async () => {
        throw new Error("reload failed");
      },
    });
    expect(result.status).toBe("saved-refresh-failed");
    expect(form.failure.value?.kind).toBe("refresh");
    expect(save).toHaveBeenCalledTimes(1);
    expect(form.dirty.value).toBe(false);
  });

  it("does not save an invalid draft", async () => {
    const { form, save } = page();
    await settle();
    form.values.subject = "";
    expect((await form.save()).status).toBe("failed");
    expect(save).not.toHaveBeenCalled();
    expect(form.errors.first("subject")).toBe("Required");
  });
});

describe("useResourceForm: rebase", () => {
  it("takes the new record and lays the kept fields of the draft on top: dirty again, saving stays deliberate", async () => {
    let record = ticket(1);
    const { form, source } = page({ load: async () => record });
    await settle();
    form.values.subject = "my edit";
    record = { ...ticket(1, "Theirs", 2), due_on: "2026-05-01" };
    await source.reload();
    form.rebase(["subject"]);
    expect(form.values.subject).toBe("my edit");
    expect(form.values.dueOn).toBe("2026-05-01");
    expect(form.dirty.value).toBe(true);
    expect(form.outdated.value).toBe(false);
  });
});
