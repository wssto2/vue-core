import { fireEvent, render } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import { defineComponent, type Component } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { createTestI18n } from "../testing/i18n";
import NextStepPanel from "./NextStepPanel.vue";
import PhaseTiles from "./PhaseTiles.vue";
import PhaseTrack from "./PhaseTrack.vue";
import RequirementList from "./RequirementList.vue";
import TodoRow from "./TodoRow.vue";
import type { RequirementItem } from "./requirementItem";

// happy-dom has no matchMedia, so these cover the wide presentation; the compact summary is the same data in a sheet.
const Page = defineComponent({ template: "<div />" });
function mountView(component: Component, props: Record<string, unknown>) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/", component: Page }, { path: "/x", name: "x", component: Page }] });
  return render(component, { props, global: { plugins: [createTestI18n(), router] } });
}
const all = (container: Element, selector: string) => [...container.querySelectorAll(selector)];
const one = (container: Element, selector: string) => container.querySelector(selector);

const steps = [{ label: "Takeover" }, { label: "Preparation", subtitle: "3 days" }, { label: "Sale" }, { label: "Archive", dashed: true }];

describe("PhaseTrack", () => {
  it("marks done, current and pending steps with aria-current on the current one", () => {
    const { container } = mountView(PhaseTrack, { steps, currentStep: 1, title: "Vehicle phase" });
    const items = all(container, "li");
    expect(items.map((li) => li.getAttribute("data-state"))).toEqual(["completed", "active", "pending", "pending"]);
    expect(items[1]!.getAttribute("aria-current")).toBe("step");
    expect(items[0]!.getAttribute("aria-current")).toBeNull();
    expect(one(container, "h3")!.textContent!.trim()).toBe("Vehicle phase");
    expect(items[1]!.textContent).toContain("3 days");
  });

  it("colours the final step with the outcome once every step is done", () => {
    const { container } = mountView(PhaseTrack, { steps, currentStep: 9, outcome: "danger" });
    expect(all(container, "li").map((li) => li.getAttribute("data-state"))).toEqual(["completed", "completed", "completed", "danger"]);
  });

  it("uses the status tone for the current step and renders a vertical timeline", () => {
    const { container } = mountView(PhaseTrack, { steps, currentStep: 2, currentTone: "warning", orientation: "vertical" });
    expect(one(container, '[data-test="phase-track"]')!.getAttribute("data-orientation")).toBe("vertical");
    expect(all(container, "li")[2]!.innerHTML).toContain("border-status-warning-content");
  });

  it("names the track and its steps with the core texts", () => {
    const { container } = mountView(PhaseTrack, { steps, currentStep: 1 });
    expect(one(container, "ol")!.getAttribute("aria-label")).toBe("Progress");
    expect(all(container, "li")[0]!.textContent).toContain("completed");
    expect(all(container, "li")[1]!.textContent).toContain("current step");
  });
});

describe("TodoRow", () => {
  it("marks each state and names it for a screen reader", () => {
    for (const state of ["done", "missing", "waiting", "optional"] as const) {
      const { container, unmount } = mountView(TodoRow, { state, label: "Orders", sub: "2 open of 3" });
      expect(one(container, "[data-todo-state]")!.getAttribute("data-todo-state")).toBe(state);
      expect(one(container, ".sr-only")!.textContent).not.toBe("");
      unmount();
    }
  });

  it("shows the current step's number, and a missing row's state in red", () => {
    const current = mountView(TodoRow, { state: "missing", label: "Handover", sub: "After the contract", step: 3 });
    expect(current.container.textContent).toContain("3");
    expect(current.container.innerHTML).not.toContain('text-status-danger-content">After');

    const missing = mountView(TodoRow, { state: "missing", label: "Required data", sub: "Missing: Colour" });
    const red = all(missing.container, "span.text-status-danger-content").filter((span) => span.textContent !== "");
    expect(red.map((span) => span.textContent)).toEqual(["Missing: Colour"]);
  });

  it("offers either a drill-in or one trailing action", async () => {
    let clicked = 0;
    const { container } = mountView(TodoRow, { state: "missing", label: "Checklist", to: { name: "x" }, action: { label: "Fill in", onClick: () => clicked++, testId: "fill" } });
    // With an action the row itself is not a link (no button inside a link).
    expect(one(container, "a")).toBeNull();
    await fireEvent.click(one(container, '[data-test="fill"]')!);
    expect(clicked).toBe(1);
  });
});

describe("NextStepPanel", () => {
  it("keeps a disabled action visible and says why under it", () => {
    const { container } = mountView(NextStepPanel, { body: "The vehicle moves to Sale.", action: { label: "Move to sale…", disabled: true }, reason: "Enter the colour first." });
    expect(one(container, "h2")!.textContent!.trim()).toBe("What's next?");
    const button = one(container, '[data-test="next-step-action"]')!;
    expect(button.textContent).toContain("Move to sale…");
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(one(container, '[data-test="next-step-reason"]')!.textContent!.trim()).toBe("Enter the colour first.");
  });

  it("names who takes a step the user may not, without an action", () => {
    const { container } = mountView(NextStepPanel, { body: "Enter the delivery date.", handoff: { name: "Ivana Maric", text: "Ivana Maric does this step." } });
    expect(one(container, '[data-test="next-step-handoff"]')!.textContent).toContain("Ivana Maric does this step.");
    expect(one(container, '[data-test="next-step-action"]')).toBeNull();
  });

  it("emits act and shows the note under a separator", async () => {
    const { container, emitted } = mountView(NextStepPanel, { action: { label: "Confirm takeover…" }, note: "“Back to appraisal” is in the ⋯ menu." });
    await fireEvent.click(one(container, '[data-test="next-step-action"]')!);
    expect(emitted().act).toHaveLength(1);
    expect(one(container, '[data-test="next-step-note"]')!.textContent).toContain("Back to appraisal");
  });
});

describe("PhaseTiles", () => {
  const phases = [
    { key: "appraisal", label: "Appraisal", state: "done" as const, sub: "Bought 12.09.2026.", to: { name: "x" } },
    { key: "takeover", label: "Takeover", state: "done" as const },
    { key: "preparation", label: "Preparation", state: "current" as const, sub: "2 items missing", tone: "warning" as const },
    { key: "sale", label: "Sale", state: "later" as const },
    { key: "delivery", label: "Delivery", state: "later" as const },
    { key: "archive", label: "Archive", state: "later" as const },
  ];

  it("shows each phase's state, the current one as the step, its state in its tone", () => {
    const { container } = mountView(PhaseTiles, { label: "Vehicle phases", phases });
    expect(all(container, '[data-test^="phase-tile-"][data-state]').map((tile) => tile.getAttribute("data-state"))).toEqual(["done", "done", "current", "later", "later", "later"]);
    const current = one(container, '[data-test="phase-tile-preparation"]')!;
    expect(current.getAttribute("aria-current")).toBe("step");
    expect(current.querySelector(".text-status-warning-content")!.textContent).toBe("2 items missing");
    // A later phase shows a dash, and only a tile with `to` is a link.
    expect(one(container, '[data-test="phase-tile-sale"]')!.textContent).toContain("—");
    expect(all(container, "a")).toHaveLength(1);
  });
});

describe("RequirementList", () => {
  function items(overrides: Partial<RequirementItem>[] = []): RequirementItem[] {
    const base: RequirementItem[] = [
      { key: "vin", label: "VIN present", met: true },
      { key: "price", label: "List price set", met: false, hint: "Enter a price" },
    ];
    return base.map((item, i) => ({ ...item, ...overrides[i] }));
  }

  it("renders one row per precondition, top to bottom", () => {
    const { container } = mountView(RequirementList, { items: items() });
    expect(all(container, 'li[data-test^="requirement-"]')).toHaveLength(2);
    expect(one(container, '[data-test="requirement-vin"]')!.getAttribute("data-met")).toBe("true");
    expect(one(container, '[data-test="requirement-price"]')!.getAttribute("data-met")).toBe("false");
  });

  it("shows the hint and a fix link only for unmet rows", () => {
    const { container } = mountView(RequirementList, { items: items([{}, { fix: { label: "Fill in", to: { name: "x" } } }]) });
    const unmet = one(container, '[data-test="requirement-price"]')!;
    expect(unmet.textContent).toContain("Enter a price");
    expect(unmet.querySelector("a")!.textContent!.trim()).toBe("Fill in");
    expect(one(container, '[data-test="requirement-vin"]')!.querySelector("a")).toBeNull();
  });

  it("collapses to a single success banner when every item is met", () => {
    const { container } = mountView(RequirementList, { items: items([{}, { met: true }]) });
    expect(one(container, '[data-test="requirements-all-met"]')).not.toBeNull();
    expect(one(container, '[data-test="requirement-list"]')).toBeNull();
    expect(container.textContent).toContain("The vehicle meets all conditions.");
  });

  it("uses a custom summaryWhenMet when provided", () => {
    const { container } = mountView(RequirementList, { items: items([{}, { met: true }]), summaryWhenMet: "Ready to activate" });
    expect(one(container, '[data-test="requirements-all-met"]')!.textContent).toContain("Ready to activate");
  });

  it("does not treat an empty list as all-met", () => {
    const { container } = mountView(RequirementList, { items: [] });
    expect(one(container, '[data-test="requirements-all-met"]')).toBeNull();
  });
});
