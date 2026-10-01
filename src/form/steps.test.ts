import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref, type App } from "vue";
import { ApiError } from "../client";
import { deferred } from "../platform/testing";
import { createLeaveGuard, leaveGuardKey } from "./leaveGuard";
import { readDraft } from "./stepDraft";
import { useStepForm, type StepDefinition, type StepFormOptions } from "./steps";
import { createTestApp, settle, withSetup } from "../testing";
import { useForm } from "./useForm";
import type { FormValidator } from "./validation";

interface Lead {
  name: string;
  email: string;
  make: string;
  budget: number | null;
  note: string;
}
const empty = (): Lead => ({ name: "", email: "", make: "", budget: null, note: "" });

/** Every field of a lead is required except the note. */
const validator: FormValidator<Lead> = {
  safeParse(input) {
    const lead = input as Lead;
    const issues: { path: string[]; message: string }[] = [];
    if (!lead.name) issues.push({ path: ["name"], message: "Name is required" });
    if (!lead.email.includes("@")) issues.push({ path: ["email"], message: "Not an e-mail" });
    if (!lead.make) issues.push({ path: ["make"], message: "Make is required" });
    if (lead.budget === null) issues.push({ path: ["budget"], message: "Budget is required" });
    return issues.length ? { success: false, error: { issues } } : { success: true, data: lead };
  },
};

const steps: StepDefinition<Lead, "customer" | "vehicle" | "review">[] = [
  { name: "customer", label: "Customer", fields: ["name", "email"] },
  { name: "vehicle", label: "Vehicle", fields: ["make", "budget"] },
  { name: "review", label: "Review" },
];

const guard = createLeaveGuard();
const releaseRoot = () => guard.attach();
const plugin = { install: (app: App) => app.provide(leaveGuardKey, guard) };

type Extra = Partial<StepFormOptions<Lead, Lead, "customer" | "vehicle" | "review", string>>;
function make(extra: Extra = {}) {
  const submit = vi.fn(async (payload: Lead) => `saved ${payload.name}`);
  const host = withSetup(() => {
    const form = useForm({ defaults: empty, validator });
    const flow = useStepForm(form, { steps, submit, submitLabel: "Create", ...extra });
    return { form, flow };
  }, createTestApp({ plugins: [plugin] }));
  return { ...host.result, submit, unmount: host.unmount };
}

const fillCustomer = (form: ReturnType<typeof make>["form"]) => Object.assign(form.values, { name: "Ana", email: "ana@example.com" });
const fillVehicle = (form: ReturnType<typeof make>["form"]) => Object.assign(form.values, { make: "Skoda", budget: 20000 });

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe("moving through the steps", () => {
  it("says where the user is and what the buttons lead to", () => {
    const { flow } = make();
    expect(flow.subtitle.value).toBe("Step 1 of 3 · Customer");
    expect(flow.nextLabel.value).toBe("Next: Vehicle");
    expect(flow.backLabel.value).toBeNull();
    expect(flow.steps.value.map((step) => step.state)).toEqual(["current", "todo", "todo"]);
  });

  it("checks only the current step's fields before Next", async () => {
    const { flow, form } = make();
    expect(await flow.next()).toBe(false);
    // The vehicle's fields are empty too, but they are not this step's business yet.
    expect(Object.keys(form.errors.all()).sort()).toEqual(["email", "name"]);
    expect(flow.current.value.name).toBe("customer");
    expect(flow.steps.value[0]!.errors).toBe(2);
    expect(flow.steps.value[1]!.errors).toBe(0);
    expect(flow.refusals.value).toBe(1);
  });

  it("moves on once the step is fine, marks it done, and names its neighbours", async () => {
    const { flow, form } = make();
    fillCustomer(form);
    expect(await flow.next()).toBe(true);
    expect(flow.current.value.name).toBe("vehicle");
    expect(flow.direction.value).toBe("forward");
    expect(flow.steps.value.map((step) => step.state)).toEqual(["done", "current", "todo"]);
    expect(flow.backLabel.value).toBe("Customer");
    expect(flow.nextLabel.value).toBe("Next: Review");
    fillVehicle(form);
    await flow.next();
    expect(flow.isLast.value).toBe(true);
    expect(flow.nextLabel.value).toBe("Create");
  });

  it("a step may name its own button", async () => {
    const { flow, form } = make({ steps: [{ ...steps[0]!, nextLabel: "Confirm" }, steps[1]!, steps[2]!] });
    expect(flow.nextLabel.value).toBe("Confirm");
    fillCustomer(form);
    await flow.next();
    expect(flow.nextLabel.value).toBe("Next: Review");
  });

  it("goes back without checking and keeps both values and the other steps' errors", async () => {
    const { flow, form } = make();
    fillCustomer(form);
    await flow.next();
    await flow.next(); // vehicle is empty: refused, its errors are on its fields
    expect(form.errors.has("make")).toBe(true);
    flow.back();
    expect(flow.current.value.name).toBe("customer");
    expect(flow.direction.value).toBe("back");
    expect(form.values.name).toBe("Ana");
    expect(flow.steps.value[1]!.errors).toBe(2); // still counted on the step they belong to
    expect(flow.steps.value[1]!.state).toBe("todo");
  });

  it("fixing one step leaves another step's errors alone", async () => {
    const { flow, form } = make();
    form.errors.set({ make: ["Taken"], name: ["Required"] });
    fillCustomer(form);
    expect(await flow.next()).toBe(true);
    expect(form.errors.first("make")).toBe("Taken");
  });

  it("goTo goes back freely, forward only to a passed step, checking the steps on the way", async () => {
    const { flow, form } = make();
    fillCustomer(form);
    await flow.next();
    fillVehicle(form);
    await flow.next(); // now on review, customer and vehicle passed
    expect(await flow.goTo("customer")).toBe(true);
    expect(flow.steps.value.map((step) => step.reachable)).toEqual([false, true, true]);
    form.values.email = "broken"; // edited after it was passed
    expect(await flow.goTo("review")).toBe(false);
    expect(flow.current.value.name).toBe("customer");
    expect(form.errors.has("email")).toBe(true);
    form.values.email = "ana@example.com";
    expect(await flow.goTo("review")).toBe(true);
    expect(flow.current.value.name).toBe("review");
  });

  it("goTo refuses a step the user has not been to", async () => {
    const { flow } = make();
    expect(await flow.goTo("review")).toBe(false);
    expect(flow.current.value.name).toBe("customer");
  });
});

describe("beforeNext", () => {
  it("holds the user on the step while it runs and when it says no", async () => {
    const lookup = deferred<boolean>();
    const { flow, form } = make({ steps: [{ ...steps[0]!, beforeNext: () => lookup.promise }, steps[1]!, steps[2]!] });
    fillCustomer(form);
    const moving = flow.next();
    expect(flow.busy.value).toBe(true);
    expect(await flow.next()).toBe(false); // one at a time
    lookup.resolve(false);
    expect(await moving).toBe(false);
    expect(flow.busy.value).toBe(false);
    expect(flow.current.value.name).toBe("customer");
    expect(flow.refusals.value).toBe(1);
  });
});

describe("sending", () => {
  it("the last step sends the whole form, then reports it and forgets the draft", async () => {
    const onSaved = vi.fn();
    const { flow, form, submit } = make({ onSaved, draft: { key: "lead" } });
    fillCustomer(form);
    await flow.next();
    fillVehicle(form);
    await flow.next();
    expect(await flow.next()).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]![0]).toMatchObject({ name: "Ana", make: "Skoda" });
    expect(onSaved).toHaveBeenCalledWith("saved Ana");
    expect(form.dirty.value).toBe(false);
    expect(readDraft({ key: "lead" })).toBeNull();
  });

  it("takes the user to the first step with an error when the validator refuses on the last one", async () => {
    const { flow, form, submit } = make();
    fillCustomer(form);
    await flow.next();
    fillVehicle(form);
    await flow.next();
    form.values.name = ""; // the answer changed meanwhile (a restored draft, a field on the review)
    expect(await flow.next()).toBe(false);
    expect(submit).not.toHaveBeenCalled();
    expect(flow.current.value.name).toBe("customer");
    expect(flow.steps.value[0]!.errors).toBe(1);
  });

  it("takes the user to the step whose field the server refused, and keeps everything entered", async () => {
    const refuse = new ApiError({ kind: "validation", message: "no", status: 422, fields: { email: ["Already in use"] } });
    const { flow, form } = make({ submit: () => Promise.reject(refuse) });
    fillCustomer(form);
    await flow.next();
    fillVehicle(form);
    await flow.next();
    expect(await flow.next()).toBe(false);
    expect(flow.current.value.name).toBe("customer");
    expect(form.errors.first("email")).toBe("Already in use");
    expect(form.values.make).toBe("Skoda");
    expect(flow.refusals.value).toBeGreaterThan(0);
  });

  it("stays on the last step when the failure is not about a field", async () => {
    const { flow, form } = make({ submit: () => Promise.reject(new ApiError({ kind: "forbidden", message: "no", status: 403 })) });
    fillCustomer(form);
    await flow.next();
    fillVehicle(form);
    await flow.next();
    expect(await flow.next()).toBe(false);
    expect(flow.current.value.name).toBe("review");
    expect(flow.failure.value?.kind).toBe("forbidden");
  });
});

describe("steps that come and go", () => {
  const equipment = ref(false);
  const dynamic = () =>
    make({
      steps: () => [
        { name: "customer" as const, label: "Customer", fields: ["name" as const, "email" as const] },
        ...(equipment.value ? [{ name: "vehicle" as const, label: "Equipment" }] : []),
        { name: "review" as const, label: "Review" },
      ],
    });

  it("counts the steps as they are now and keeps the user on theirs", async () => {
    equipment.value = false;
    const { flow, form } = dynamic();
    expect(flow.count.value).toBe(2);
    fillCustomer(form);
    await flow.next();
    equipment.value = true; // an answer on the review changed what is asked
    await settle();
    expect(flow.count.value).toBe(3);
    expect(flow.current.value.name).toBe("review");
    expect(flow.subtitle.value).toBe("Step 3 of 3 · Review");
    expect(flow.backLabel.value).toBe("Equipment");
  });

  it("when the current step goes away the user lands on the one that took its place, and later steps are no longer done", async () => {
    equipment.value = true;
    const { flow, form } = dynamic();
    fillCustomer(form);
    await flow.next();
    await flow.next(); // equipment has no fields
    expect(flow.current.value.name).toBe("review");
    await flow.goTo("customer");
    equipment.value = false;
    await settle();
    expect(flow.current.value.name).toBe("customer");
    expect(flow.steps.value.map((step) => step.name)).toEqual(["customer", "review"]);
    expect(flow.steps.value[1]!.reachable).toBe(false); // the answers it stood on changed
  });

  it("a flow needs a step", () => {
    expect(() => make({ steps: [] })).toThrow(/at least one step/);
  });
});

describe("the draft", () => {
  const enter = async (flow: ReturnType<typeof make>["flow"], form: ReturnType<typeof make>["form"]) => {
    fillCustomer(form);
    await flow.next();
    form.values.make = "Skoda";
  };

  it("is stored a moment after the last change, with the step and the steps passed", async () => {
    vi.useFakeTimers();
    const { flow, form } = make({ draft: { key: "lead:new" } });
    await enter(flow, form);
    expect(readDraft({ key: "lead:new" })).toBeNull(); // not yet
    await vi.advanceTimersByTimeAsync(500);
    expect(readDraft({ key: "lead:new" })).toEqual({ version: 1, values: expect.objectContaining({ name: "Ana", make: "Skoda" }), step: "vehicle", passed: ["customer"] });
    expect(flow.subtitle.value).toBe("Step 2 of 3 · Vehicle · draft saved");
  });

  it("is put back after a reload: the values, the step and what was passed", async () => {
    vi.useFakeTimers();
    const first = make({ draft: { key: "lead:new" } });
    await enter(first.flow, first.form);
    await vi.advanceTimersByTimeAsync(500);
    first.unmount();

    const second = make({ draft: { key: "lead:new" } });
    expect(second.form.values).toMatchObject({ name: "Ana", make: "Skoda" });
    expect(second.flow.current.value.name).toBe("vehicle");
    expect(second.flow.steps.value[0]!.state).toBe("done");
    expect(second.flow.restored.value).toBe(true);
    expect(second.form.dirty.value).toBe(true); // a restored draft is unsaved work
  });

  it("is ignored when its version is not the form's, and only fills fields that exist with the same kind of value", async () => {
    window.sessionStorage.setItem("vue-core:step-draft:old", JSON.stringify({ version: 1, values: { name: "Old" }, step: "customer", passed: [] }));
    expect(make({ draft: { key: "old", version: 2 } }).form.values.name).toBe("");
    window.sessionStorage.setItem("vue-core:step-draft:odd", JSON.stringify({ version: 1, values: { name: 7, gone: "x", make: "Skoda" }, step: "nowhere", passed: ["nowhere"] }));
    const { form, flow } = make({ draft: { key: "odd" } });
    expect(form.values.name).toBe(""); // a number does not go into text
    expect(form.values.make).toBe("Skoda");
    expect("gone" in form.values).toBe(false);
    expect(flow.current.value.name).toBe("customer");
  });

  it("can live in the local storage", async () => {
    vi.useFakeTimers();
    const { flow, form } = make({ draft: { key: "lead", storage: "local" } });
    await enter(flow, form);
    await vi.advanceTimersByTimeAsync(500);
    expect(window.localStorage.getItem("vue-core:step-draft:lead")).not.toBeNull();
    expect(window.sessionStorage.getItem("vue-core:step-draft:lead")).toBeNull();
  });

  it("keeps working when the storage is blocked", async () => {
    vi.useFakeTimers();
    const blocked = vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const { flow, form } = make({ draft: { key: "lead" } });
    await enter(flow, form);
    await vi.advanceTimersByTimeAsync(500);
    expect(flow.subtitle.value).toBe("Step 2 of 3 · Vehicle"); // never saved, so not claimed
    expect(flow.current.value.name).toBe("vehicle");
    blocked.mockRestore();
  });

  it("is dropped by starting over, and keeps nothing for a form that is back to empty", async () => {
    vi.useFakeTimers();
    const { flow, form } = make({ draft: { key: "lead" } });
    await enter(flow, form);
    await vi.advanceTimersByTimeAsync(500);
    expect(readDraft({ key: "lead" })).not.toBeNull();
    flow.restart();
    expect(readDraft({ key: "lead" })).toBeNull();
    expect(flow.current.value.name).toBe("customer");
    expect(form.values.name).toBe("");
    form.values.name = "x";
    await vi.advanceTimersByTimeAsync(500);
    expect(readDraft({ key: "lead" })).not.toBeNull(); // a new draft starts
    form.values.name = "";
    await vi.advanceTimersByTimeAsync(500);
    expect(readDraft({ key: "lead" })).toBeNull();
  });

  it("an edit still waiting for its turn is written when the flow goes away", async () => {
    vi.useFakeTimers();
    const { flow, form, unmount } = make({ draft: { key: "lead" } });
    await enter(flow, form);
    unmount();
    expect(readDraft({ key: "lead" })).not.toBeNull();
  });
});

describe("discarding", () => {
  it("lets the user go without asking when nothing was entered", async () => {
    const release = releaseRoot();
    const { flow } = make();
    expect(await flow.confirmDiscard()).toBe(true);
    expect(guard.pending.value).toBeNull();
    release();
  });

  it("asks when there is something to lose; yes removes the draft, no keeps it", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const release = releaseRoot();
    const { flow, form } = make({ draft: { key: "lead" } });
    fillCustomer(form);
    await vi.advanceTimersByTimeAsync(500);
    expect(readDraft({ key: "lead" })).not.toBeNull();

    const staying = flow.confirmDiscard();
    expect(guard.pending.value).not.toBeNull();
    guard.pending.value!.resolve(false);
    expect(await staying).toBe(false);
    expect(readDraft({ key: "lead" })).not.toBeNull();

    const leaving = flow.confirmDiscard();
    guard.pending.value!.resolve(true);
    expect(await leaving).toBe(true);
    expect(readDraft({ key: "lead" })).toBeNull();
    // Gone for good: later edits do not bring it back, and nothing is left to ask about.
    form.values.name = "More";
    await vi.advanceTimersByTimeAsync(500);
    expect(readDraft({ key: "lead" })).toBeNull();
    expect(await flow.confirmDiscard()).toBe(true);
    release();
  });

  it("binds what a Modal takes", async () => {
    const { flow, form } = make();
    expect(flow.bindDialog()).toMatchObject({ subtitle: "Step 1 of 3 · Customer", primaryLabel: "Next: Vehicle", status: "idle" });
    fillCustomer(form);
    await flow.next();
    expect(flow.bindDialog().subtitle).toBe("Step 2 of 3 · Vehicle");
  });
});
