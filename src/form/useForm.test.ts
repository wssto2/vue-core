import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../client";
import { deferred } from "../platform/testing";
import { withSetup } from "./testing";
import { useForm } from "./useForm";
import type { FormValidator } from "./validation";

interface Ticket {
  subject: string;
  priority: number | null;
  tags: string[];
  contact: { email: string; phone: string };
}
const empty = (): Ticket => ({ subject: "", priority: null, tags: [], contact: { email: "", phone: "" } });

/** A hand-written validator: the library asks for Zod's `safeParse` shape, not for Zod. */
const validator: FormValidator<{ subject: string; priority: number }> = {
  safeParse(input) {
    const value = input as Ticket;
    const issues = [];
    if (!value.subject.trim()) issues.push({ path: ["subject"], message: "Required" });
    if (value.priority === null) issues.push({ path: ["priority"], message: "Pick one" });
    if (value.contact.email && !value.contact.email.includes("@")) issues.push({ path: ["contact", "email"], message: "Not an e-mail" });
    return issues.length ? { success: false, error: { issues } } : { success: true, data: { subject: value.subject.trim(), priority: value.priority as number } };
  },
};

const make = () => withSetup(() => useForm({ defaults: empty, validator })).result;
const filled = (form: ReturnType<typeof make>) => {
  form.values.subject = "  Printer  ";
  form.values.priority = 2;
};
const api = (kind: ApiError["kind"], extra: Partial<ConstructorParameters<typeof ApiError>[0]> = {}) => new ApiError({ kind, message: "no", status: 400, ...extra });

describe("useForm: values and binding", () => {
  it("binds a field: its value, its change, its error", () => {
    const form = make();
    const binding = form.bind("subject");
    expect(binding.modelValue).toBe("");
    expect(binding["data-field-key"]).toBe("subject");
    binding["onUpdate:modelValue"]("Hello");
    expect(form.values.subject).toBe("Hello");
    form.errors.add("subject", "Required");
    expect(form.bind("subject").error).toBe("Required");
  });

  it("clears a field's message when the user changes that field, and only that one", () => {
    const form = make();
    form.errors.set({ subject: ["Required"], priority: ["Pick one"] });
    form.bind("subject")["onUpdate:modelValue"]("x");
    expect(form.errors.first("subject")).toBeUndefined();
    expect(form.errors.first("priority")).toBe("Pick one");
  });

  it("starts from a copy of the defaults: two forms never share a nested value", () => {
    const shared = empty();
    const first = withSetup(() => useForm({ defaults: shared })).result;
    const second = withSetup(() => useForm({ defaults: shared })).result;
    first.values.tags.push("a");
    expect(second.values.tags).toEqual([]);
    expect(shared.tags).toEqual([]);
  });
});

describe("useForm: dirty baseline", () => {
  it("is clean at first, dirty after an edit, clean again when the edit is undone", () => {
    const form = make();
    expect(form.dirty.value).toBe(false);
    form.values.subject = "a";
    expect(form.dirty.value).toBe(true);
    form.values.subject = "";
    expect(form.dirty.value).toBe(false);
  });

  it("sees an edit made inside a list or an object in place (ARV compared a shallow copy: the baseline changed with the draft)", () => {
    const form = make();
    form.hydrate({ ...empty(), tags: ["a", "b"] });
    form.values.tags[0] = "changed";
    expect(form.dirty.value).toBe(true);
    form.values.tags[0] = "a";
    expect(form.dirty.value).toBe(false);
    form.values.contact.email = "x@y.z";
    expect(form.dirty.value).toBe(true);
    form.reset();
    expect(form.values.contact.email).toBe("");
    expect(form.dirty.value).toBe(false);
  });

  it("hydrate takes new values as draft and baseline and clears errors; markClean takes the draft", () => {
    const form = make();
    form.errors.add("subject", "Required");
    form.hydrate({ ...empty(), subject: "Loaded" });
    expect(form.values.subject).toBe("Loaded");
    expect(form.dirty.value).toBe(false);
    expect(form.errors.count.value).toBe(0);
    form.values.priority = 3;
    form.markClean();
    expect(form.dirty.value).toBe(false);
  });

  it("reset puts the baseline back and clears the failure", () => {
    const form = make();
    form.values.subject = "edited";
    form.errors.add("subject", "x");
    form.reset();
    expect(form.values.subject).toBe("");
    expect(form.errors.count.value).toBe(0);
  });

  it("compares dates by time", () => {
    const form = withSetup(() => useForm({ defaults: () => ({ at: new Date("2026-01-01T10:00:00Z") as Date | null }) })).result;
    form.values.at = new Date("2026-01-01T10:00:00Z");
    expect(form.dirty.value).toBe(false);
    form.values.at = new Date("2026-01-02T10:00:00Z");
    expect(form.dirty.value).toBe(true);
  });
});

describe("useForm: validation", () => {
  it("places the validator's issues on their fields, nested ones under their dotted path, and returns null", () => {
    const form = make();
    form.values.contact.email = "nope";
    expect(form.validate()).toBeNull();
    expect(form.errors.first("subject")).toBe("Required");
    expect(form.errors.first("priority")).toBe("Pick one");
    expect(form.errors.first("contact.email")).toBe("Not an e-mail");
    expect(form.errors.has("contact")).toBe(true);
  });

  it("returns the parsed output and never rewrites the draft with it (ARV replaced the values with the parsed ones)", () => {
    const form = make();
    filled(form);
    expect(form.validate()).toEqual({ subject: "Printer", priority: 2 });
    expect(form.values.subject).toBe("  Printer  ");
  });

  it("without a validator everything is accepted: the server is the only judge", () => {
    const form = withSetup(() => useForm({ defaults: empty })).result;
    expect(form.validate()).toEqual(empty());
  });

  it("check judges only the given fields", () => {
    const form = make();
    form.values.subject = "ok";
    expect(form.check(["subject"])).toBe(true);
    expect(form.errors.count.value).toBe(0);
    expect(form.check(["subject", "priority"])).toBe(false);
    expect(form.errors.first("priority")).toBe("Pick one");
  });
});

describe("useForm: submit", () => {
  it("does not send an invalid form; the draft and the messages stay", async () => {
    const form = make();
    const send = vi.fn();
    const result = await form.submit(send);
    expect(send).not.toHaveBeenCalled();
    expect(result.status).toBe("failed");
    expect(form.failure.value?.kind).toBe("invalid");
    expect(form.errors.first("subject")).toBe("Required");
  });

  it("sends the validator's output, then takes the draft as the baseline", async () => {
    const form = make();
    filled(form);
    const send = vi.fn(async (payload: { subject: string; priority: number }) => ({ id: 1, ...payload }));
    const result = await form.submit(send);
    expect(send.mock.calls[0]?.[0]).toEqual({ subject: "Printer", priority: 2 });
    expect(result).toEqual({ status: "saved", value: { id: 1, subject: "Printer", priority: 2 } });
    expect(form.dirty.value).toBe(false);
    expect(form.submitting.value).toBe(false);
  });

  it("collapses a double submit into one request and one result", async () => {
    const form = make();
    filled(form);
    const gate = deferred<string>();
    const send = vi.fn(() => gate.promise);
    const first = form.submit(send);
    const second = form.submit(send);
    expect(form.submitting.value).toBe(true);
    gate.resolve("done");
    expect(await first).toEqual({ status: "saved", value: "done" });
    expect(await second).toEqual({ status: "saved", value: "done" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("gives the duplicate clicks of one attempt the same idempotency key, and a retry a new one", async () => {
    const form = make();
    filled(form);
    const keys: string[] = [];
    const send = vi.fn(async (_payload: unknown, context: { idempotencyKey: string }) => {
      keys.push(context.idempotencyKey);
      if (keys.length === 1) throw api("server", { status: 500 });
      return "ok";
    });
    void form.submit(send);
    await form.submit(send);
    await form.submit(send);
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("a failed save keeps the draft dirty and the form usable", async () => {
    const form = make();
    filled(form);
    const result = await form.submit(async () => {
      throw api("server", { status: 500, requestId: "req-7" });
    });
    expect(result).toMatchObject({ status: "failed", failure: { kind: "failed", requestId: "req-7" } });
    expect(form.values.subject).toBe("  Printer  ");
    expect(form.dirty.value).toBe(true);
    expect(form.submitting.value).toBe(false);
    expect((await form.submit(async () => "ok")).status).toBe("saved");
    expect(form.failure.value).toBeNull();
  });

  it.each([
    ["conflict", api("conflict", { status: 409 }), "conflict"],
    ["forbidden", api("forbidden", { status: 403 }), "forbidden"],
    ["an expired session", api("unauthorized", { status: 401 }), "unauthorized"],
    ["no answer", api("network", { status: null }), "offline"],
    ["anything else", new Error("boom"), "failed"],
  ] as const)("tells %s from the other failures", async (_name, error, kind) => {
    const form = make();
    filled(form);
    const result = await form.submit(async () => {
      throw error;
    });
    expect(result).toMatchObject({ status: "failed", failure: { kind } });
    expect(form.failure.value?.message).not.toBe("");
    expect(form.errors.count.value).toBe(0);
  });

  it("lands a server validation answer on the fields, translated, and keeps the draft", async () => {
    const form = withSetup(() => useForm({ defaults: empty, translate: (message) => `t:${message}` })).result;
    form.values.subject = "x";
    const result = await form.submit(async () => {
      throw api("validation", { status: 422, fields: { subject: ["validation_errors.unique"], "contact.email": ["bad"] } });
    });
    expect(result).toMatchObject({ status: "failed", failure: { kind: "invalid" } });
    expect(form.errors.first("subject")).toBe("t:validation_errors.unique");
    expect(form.errors.first("contact.email")).toBe("t:bad");
    expect(form.dirty.value).toBe(true);
  });

  it("puts a server error on the draft's name for the field (tax_id is taxId), nested paths too", async () => {
    const form = withSetup(() => useForm({ defaults: () => ({ taxId: "", lines: [{ unitPrice: 0 }] }), serverField: (field) => field.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()) })).result;
    await form.submit(async () => {
      throw api("validation", { status: 422, fields: { tax_id: ["11 digits"], "lines.0.unit_price": ["too low"] } });
    });
    expect(form.errors.first("taxId")).toBe("11 digits");
    expect(form.errors.first("lines.0.unitPrice")).toBe("too low");
    expect(form.bind("taxId").error).toBe("11 digits");
  });

  it("does not report a cancelled request as a failure", async () => {
    const form = make();
    filled(form);
    const result = await form.submit(async () => {
      throw api("aborted", { status: null });
    });
    expect(result).toEqual({ status: "aborted" });
    expect(form.failure.value).toBeNull();
  });

  it("tells a save that worked but whose refresh failed from a failed save: the draft is the new baseline, retrying would repeat the mutation", async () => {
    const form = make();
    filled(form);
    const send = vi.fn(async () => "created");
    const refresh = vi.fn(async () => {
      throw api("server", { status: 500 });
    });
    const result = await form.submit(send, { refresh });
    expect(result).toMatchObject({ status: "saved-refresh-failed", value: "created" });
    expect(form.failure.value?.kind).toBe("refresh");
    expect(form.dirty.value).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("takes what the save returned as draft and baseline when asked (the record as the server stored it)", async () => {
    const form = make();
    filled(form);
    await form.submit(async () => ({ subject: "Stored" }), { hydrateFrom: (saved) => ({ ...empty(), subject: saved.subject }) });
    expect(form.values.subject).toBe("Stored");
    expect(form.dirty.value).toBe(false);
  });

  it("keeps what the user typed while the request was in flight as unsaved", async () => {
    const form = make();
    filled(form);
    const gate = deferred<string>();
    const pending = form.submit(() => gate.promise);
    form.values.subject = "typed meanwhile";
    gate.resolve("ok");
    await pending;
    expect(form.dirty.value).toBe(true);
  });
});

describe("useForm: submitting some fields (a group with an endpoint of its own)", () => {
  it("judges and sends only those fields, exactly as drafted, and moves only their baseline", async () => {
    const form = make();
    form.values.subject = "Kept";
    form.values.contact.email = "a@b.c";
    form.values.priority = null; // invalid for the whole form, but not part of this group
    const send = vi.fn(async (changes: { contact: { email: string; phone: string } }) => changes);
    const result = await form.submitFields(["contact"], send);
    expect(result.status).toBe("saved");
    expect(send.mock.calls[0]?.[0]).toEqual({ contact: { email: "a@b.c", phone: "" } });
    form.reset();
    expect(form.values.contact.email).toBe("a@b.c");
    expect(form.values.subject).toBe("");
  });

  it("refuses when one of its own fields is invalid", async () => {
    const form = make();
    form.values.contact.email = "nope";
    const send = vi.fn();
    const result = await form.submitFields(["contact"], send);
    expect(send).not.toHaveBeenCalled();
    expect(result.status).toBe("failed");
    expect(form.errors.first("contact.email")).toBe("Not an e-mail");
    expect(form.errors.has("subject")).toBe(false);
  });
});
