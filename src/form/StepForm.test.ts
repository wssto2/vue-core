import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick, ref, type App, type Component } from "vue";
import Modal from "../modal/Modal.vue";
import { createTestI18n } from "../testing/i18n";
import { createLeaveGuard, leaveGuardKey } from "./leaveGuard";
import StepForm from "./StepForm.vue";
import StepNavigation from "./StepNavigation.vue";
import StepProgress from "./StepProgress.vue";
import { useStepForm } from "./steps";
import { settle } from "./testing";
import TextField from "./TextField.vue";
import { useForm } from "./useForm";
import type { FormValidator } from "./validation";

interface Lead {
  name: string;
  email: string;
  make: string;
}
const validator: FormValidator<Lead> = {
  safeParse(input) {
    const lead = input as Lead;
    const issues: { path: string[]; message: string }[] = [];
    if (!lead.name) issues.push({ path: ["name"], message: "Name is required" });
    if (!lead.email) issues.push({ path: ["email"], message: "E-mail is required" });
    if (!lead.make) issues.push({ path: ["make"], message: "Make is required" });
    return issues.length ? { success: false, error: { issues } } : { success: true, data: lead };
  },
};

const guard = createLeaveGuard();
guard.attach();
const global = {
  plugins: [createTestI18n("en"), { install: (app: App) => app.provide(leaveGuardKey, guard) }],
  stubs: { transition: false as boolean | Component },
};

beforeEach(() => window.sessionStorage.clear());
afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
});

function mountFlow(template: string, options: { draftKey?: string; onSaved?: () => void } = {}) {
  const saved = vi.fn(async () => "ok");
  const cancelled = vi.fn();
  let handles!: { form: ReturnType<typeof useForm<Lead>>; flow: ReturnType<typeof useStepForm<Lead, Lead, "customer" | "vehicle" | "review", string>>; modal: { value: { present: () => void } | null } };
  const Host = defineComponent({
    components: { StepForm, StepNavigation, StepProgress, TextField, Modal },
    setup() {
      const form = useForm({ defaults: (): Lead => ({ name: "", email: "", make: "" }), validator });
      const flow = useStepForm(form, {
        steps: [
          { name: "customer", label: "Customer", fields: ["name", "email"] },
          { name: "vehicle", label: "Vehicle", fields: ["make"] },
          { name: "review", label: "Review" },
        ],
        submit: saved,
        submitLabel: "Create",
        onSaved: options.onSaved,
        draft: options.draftKey ? { key: options.draftKey } : undefined,
      });
      const modal = ref<{ present: () => void } | null>(null);
      handles = { form, flow, modal };
      return { form, flow, cancelled, modal };
    },
    template,
  });
  const view = render(Host, { global });
  return { ...view, saved, cancelled, get form() { return handles.form; }, get flow() { return handles.flow; }, get modal() { return handles.modal; } };
}

const STEPS = `
  <template #customer><TextField v-bind="form.bind('name')" label="Name" /><TextField v-bind="form.bind('email')" label="E-mail" /></template>
  <template #vehicle><TextField v-bind="form.bind('make')" label="Make" /></template>
  <template #review><p>Everything fine?</p></template>`;
const PAGE = `<StepForm :flow="flow" @cancel="cancelled">${STEPS}</StepForm>`;

const type = async (label: string, value: string) => fireEvent.update(screen.getByLabelText(label), value);
const q = (test: string) => document.querySelector<HTMLElement>(`[data-test="${test}"]`);

describe("StepForm with a bar", () => {
  it("shows every step with its number and name, and marks the current one", () => {
    mountFlow(PAGE);
    const items = [...document.querySelectorAll('[data-test="step-bar"] li')];
    expect(items.map((item) => item.textContent?.trim())).toEqual(["1. Customer", "2. Vehicle", "3. Review"]);
    expect(items[0]!.getAttribute("aria-current")).toBe("step");
    expect(q("step-customer")!.tagName).toBe("DIV"); // nothing to click yet
  });

  it("shows only the current step's fields", async () => {
    mountFlow(PAGE);
    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(screen.queryByLabelText("Make")).toBeNull();
  });

  it("Next names its target, refuses a step with errors, counts them on the step and puts focus on the first", async () => {
    mountFlow(PAGE);
    const next = screen.getByRole("button", { name: "Next: Vehicle" });
    await fireEvent.click(next);
    await settle();
    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(q("step-errors")!.textContent).toBe("2");
    expect(q("step-errors")!.getAttribute("aria-label")).toBe("Errors: 2");
    expect(q("step-customer")!.getAttribute("data-state")).toBe("error");
    expect(document.activeElement).toBe(screen.getByLabelText("Name"));
  });

  it("moves on, marks the step done with a check, and a done step is a button that goes back to it", async () => {
    const { flow } = mountFlow(PAGE);
    await type("Name", "Ana");
    await type("E-mail", "ana@example.com");
    await fireEvent.click(screen.getByRole("button", { name: "Next: Vehicle" }));
    await settle();
    expect(screen.getByLabelText("Make")).toBeTruthy();
    expect(q("step-body")!.className).toContain("animate-step-in");
    expect(document.activeElement).toBe(q("step-body")); // focus follows the step, not a field
    const done = q("step-customer")!;
    expect(done.tagName).toBe("BUTTON");
    expect(done.textContent).toContain("done");
    await fireEvent.click(done);
    await settle();
    expect(flow.current.value.name).toBe("customer");
    expect(q("step-body")!.className).toContain("animate-step-back");
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Ana"); // nothing lost
  });

  it("Back is named after the previous step", async () => {
    const { flow } = mountFlow(PAGE);
    expect(screen.queryByRole("button", { name: /Customer/ })).toBeNull();
    await type("Name", "Ana");
    await type("E-mail", "a@b.c");
    await flow.next();
    await settle();
    await fireEvent.click(screen.getByRole("button", { name: "Customer" }));
    await settle();
    expect(flow.current.value.name).toBe("customer");
  });

  it("Enter in a field is Next", async () => {
    const { flow } = mountFlow(PAGE);
    await type("Name", "Ana");
    await type("E-mail", "a@b.c");
    await fireEvent.submit(q("step-body")!);
    await settle();
    expect(flow.current.value.name).toBe("vehicle");
  });

  it("the last step's button is the flow's submit label, and sending reports back", async () => {
    const onSaved = vi.fn();
    const { flow, saved } = mountFlow(PAGE, { onSaved });
    await type("Name", "Ana");
    await type("E-mail", "a@b.c");
    await flow.next();
    await settle();
    await type("Make", "Skoda");
    await flow.next();
    await settle();
    await fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await settle();
    expect(saved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith("ok");
  });

  it("Cancel is the page's to answer", async () => {
    const { cancelled } = mountFlow(PAGE);
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it("announces the step for screen readers", async () => {
    const { flow } = mountFlow(PAGE);
    expect(document.querySelector('[aria-live="polite"]')!.textContent).toBe("Step 1 of 3 · Customer");
    await type("Name", "Ana");
    await type("E-mail", "a@b.c");
    await flow.next();
    await settle();
    expect(document.querySelector('[aria-live="polite"]')!.textContent).toBe("Step 2 of 3 · Vehicle");
  });
});

describe("StepForm with dots", () => {
  it("draws one dot per step with the current one wide, and no names", async () => {
    const { flow } = mountFlow(`<StepForm :flow="flow" progress="dots">${STEPS}</StepForm>`);
    const dots = () => [...document.querySelectorAll('[data-test="step-dots"] span')];
    expect(dots()).toHaveLength(3);
    expect(dots().map((dot) => dot.className.includes("w-4.5"))).toEqual([true, false, false]);
    expect(q("step-bar")).toBeNull();
    await type("Name", "Ana");
    await type("E-mail", "a@b.c");
    await flow.next();
    await settle();
    expect(dots().map((dot) => dot.className.includes("w-4.5"))).toEqual([false, true, false]);
    expect(dots().map((dot) => dot.className.includes("bg-tint"))).toEqual([true, true, false]); // behind and at the current one
  });
});

describe("StepForm in a dialog", () => {
  const DIALOG = `
    <Modal ref="modal" title="New lead" v-bind="flow.bindDialog()" grouped size="md" @primary="flow.next()">
      <template #header><StepProgress :flow="flow" /></template>
      <template #timestamp><button v-if="flow.backLabel.value" type="button" data-test="dialog-back" @click="flow.back()">{{ flow.backLabel.value }}</button></template>
      <StepForm :flow="flow" progress="none" navigation="host">${STEPS}</StepForm>
    </Modal>`;

  it("takes the subtitle, the primary button and the question before closing from the flow; the bar goes in the header", async () => {
    const { modal, flow } = mountFlow(DIALOG);
    modal.value!.present();
    await settle();
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("Step 1 of 3 · Customer");
    expect(dialog.querySelector('[data-test="step-bar"]')).not.toBeNull();
    expect(dialog.querySelector('[data-test="step-navigation"]')).toBeNull();
    await type("Name", "Ana");
    await type("E-mail", "a@b.c");
    await fireEvent.click(dialog.querySelector('[data-part="primary"] button')!);
    await settle();
    expect(flow.current.value.name).toBe("vehicle");
    expect(dialog.textContent).toContain("Step 2 of 3 · Vehicle");
    expect(dialog.querySelector('[data-test="dialog-back"]')!.textContent).toBe("Customer");
    // Escape with something entered asks first.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await settle();
    expect(guard.pending.value).not.toBeNull();
    guard.pending.value!.resolve(false);
    await settle();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("has no buttons of its own when the host owns them", () => {
    mountFlow(`<StepForm :flow="flow" navigation="host">${STEPS}</StepForm>`);
    expect(q("step-navigation")).toBeNull();
    expect(q("step-bar")).not.toBeNull();
  });

  it("StepNavigation puts the same buttons in a footer of the host's own", async () => {
    mountFlow(`<div><StepForm :flow="flow" navigation="host">${STEPS}</StepForm><footer><StepNavigation :flow="flow" @cancel="cancelled" /></footer></div>`);
    await type("Name", "Ana");
    await type("E-mail", "a@b.c");
    await fireEvent.click(screen.getByRole("button", { name: "Next: Vehicle" }));
    await settle();
    expect(screen.getByLabelText("Make")).toBeTruthy();
  });
});

describe("a restored draft", () => {
  it("says so and offers to start over", async () => {
    window.sessionStorage.setItem("vue-core:step-draft:lead", JSON.stringify({ version: 1, values: { name: "Ana", email: "a@b.c" }, step: "vehicle", passed: ["customer"] }));
    const { flow } = mountFlow(PAGE, { draftKey: "lead" });
    expect(screen.getByLabelText("Make")).toBeTruthy();
    expect(q("step-restored")!.textContent).toContain("Continuing your saved draft.");
    await fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    await nextTick();
    expect(q("step-restored")).toBeNull();
    expect(flow.current.value.name).toBe("customer");
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("");
  });

  it("goes away once the user moves", async () => {
    window.sessionStorage.setItem("vue-core:step-draft:lead", JSON.stringify({ version: 1, values: { name: "Ana", email: "a@b.c" }, step: "customer", passed: [] }));
    mountFlow(PAGE, { draftKey: "lead" });
    expect(q("step-restored")).not.toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: "Next: Vehicle" }));
    await settle();
    expect(q("step-restored")).toBeNull();
  });
});

describe("errors that belong to another step", () => {
  it("do not claim to be hidden once the step that has them is on screen", async () => {
    const { flow, form } = mountFlow(PAGE);
    await type("Name", "Ana");
    await type("E-mail", "a@b.c");
    await flow.next();
    await settle();
    form.errors.set({ email: ["Already in use"] }); // the server's answer arrives while the user is on the vehicle step
    await settle();
    expect(document.querySelector('[data-test="form-errors-hidden"]')).not.toBeNull(); // its field is on another step
    flow.back();
    await settle();
    expect(screen.getByLabelText("E-mail")).toBeTruthy();
    expect(document.querySelector('[data-test="form-errors-hidden"]')).toBeNull();
  });
});
