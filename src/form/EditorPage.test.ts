import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, type App } from "vue";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { ApiError } from "../client";
import SectionPanel from "../page/SectionPanel.vue";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import { mockMedia } from "../testing/media";
import EditorPage from "./EditorPage.vue";
import { createLeaveGuard, leaveGuardKey } from "./leaveGuard";
import LeaveGuardRoot from "./LeaveGuardRoot.vue";
import NumberField from "./NumberField.vue";
import TextField from "./TextField.vue";
import { settle } from "../testing";
import { useForm } from "./useForm";

const i18n = createTestI18n();

interface Offer {
  customer: string;
  quantity: number | null;
  note: string;
}
const empty = (): Offer => ({ customer: "", quantity: null, note: "" });

let media: ReturnType<typeof mockMedia>;
beforeEach(() => {
  media = mockMedia();
});
afterEach(() => {
  media.restore();
  document.body.innerHTML = "";
  document.body.className = "";
});

const makeForm = () =>
  useForm({
    defaults: empty,
    validator: {
      safeParse: (input) => {
        const value = input as Offer;
        const issues = [...(value.customer ? [] : [{ path: ["customer"], message: "Customer is required" }]), ...(value.quantity ? [] : [{ path: ["quantity"], message: "Enter a quantity" }])];
        return issues.length ? { success: false, error: { issues } } : { success: true, data: value };
      },
    },
  });

/** An offer-like long create form: three sections (the middle one collapsible), two required fields, a summary aside. */
async function openEditor(options: { submit?: (form: ReturnType<typeof makeForm>) => Promise<unknown>; canSave?: boolean; collapseLines?: boolean } = {}) {
  const guard = createLeaveGuard();
  const saved = vi.fn();
  const cancelled = vi.fn();
  let form!: ReturnType<typeof makeForm>;
  const Editor = defineComponent({
    setup() {
      form = makeForm();
      const submit = async () => {
        saved();
        await (options.submit ? options.submit(form) : form.submit(async () => "ok"));
      };
      return () =>
        h(
          EditorPage,
          { title: "New offer", back: { label: "Offers", to: "/offers" }, form, saveLabel: "Create offer", canSave: options.canSave ?? true, fieldLabel: (key: string) => key.toUpperCase(), onSave: submit, onCancel: cancelled },
          {
            default: () => [
              h(SectionPanel, { title: "Customer", number: "01", presentation: "section" }, () => h(TextField, { ...form.bind("customer"), label: "Customer", required: true })),
              h(SectionPanel, { title: "Lines", number: "02", presentation: "section", collapsible: true, collapsed: options.collapseLines ?? false }, () => h(NumberField, { ...form.bind("quantity"), label: "Quantity", required: true })),
              h(SectionPanel, { title: "Notes", number: "03", presentation: "section" }, () => h(TextField, { ...form.bind("note"), label: "Note" })),
            ],
            aside: () => h("p", { "data-test": "summary" }, `Quantity ${form.values.quantity ?? 0}`),
          },
        );
    },
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/editor", component: Editor },
      { path: "/offers", component: defineComponent({ render: () => h("p", "offers") }) },
    ],
  });
  await router.push("/editor");
  const view = render(defineComponent({ render: () => h("div", [h(RouterView), h(LeaveGuardRoot)]) }), {
    global: { plugins: [router, i18n, testFormatting(i18n), { install: (app: App) => app.provide(leaveGuardKey, guard) }], stubs: { transition: false } },
  });
  await settle();
  return { ...view, form: () => form, saved, cancelled, router };
}
const saveButton = () => screen.getAllByRole("button", { name: /Create offer/ })[0]!;
const link = (id: string) => document.querySelector<HTMLElement>(`[data-test='section-link-${id}']`)!;

describe("EditorPage", () => {
  it("shows the sections beside the form with the required-field progress, and the editor's own aside", async () => {
    await openEditor();
    expect([...document.querySelectorAll("[data-test^='section-link-']")].map((each) => each.textContent?.replace(/\s+/g, "").trim())).toEqual(["01Customer", "02Lines", "03Notes"]);
    expect(document.querySelector("[data-test='section-progress']")?.textContent).toContain("0 of 2");
    expect(document.querySelector("[data-test='summary']")?.textContent).toBe("Quantity 0");
  });

  it("counts a required field as done once it is filled, and a section as done once all its required fields are", async () => {
    const { form } = await openEditor();
    form().values.customer = "Acme";
    await settle();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.querySelector("[data-test='section-progress']")?.textContent).toContain("1 of 2");
    expect(link("customer").getAttribute("data-state")).toBe("done");
    expect(link("lines").getAttribute("data-state")).toBeNull();
  });

  it("puts Save in the page chrome, which asks the feature to submit; not while one is running", async () => {
    const gate: { release?: () => void } = {};
    const { form, saved } = await openEditor({
      submit: (f) => f.submit(() => new Promise<string>((resolve) => (gate.release = () => resolve("ok")))),
    });
    form().values.customer = "Acme";
    form().values.quantity = 2;
    await settle();
    await fireEvent.click(saveButton());
    await settle();
    expect(saved).toHaveBeenCalledTimes(1);
    await fireEvent.click(saveButton());
    expect(saved).toHaveBeenCalledTimes(1);
    gate.release?.();
    await settle();
  });

  it("offers no Save to a viewer who may not save", async () => {
    await openEditor({ canSave: false });
    expect(screen.queryByRole("button", { name: /Create offer/ })).toBeNull();
  });

  it("says when there are unsaved edits, and Cancel puts the form back and tells the feature", async () => {
    const { form, cancelled } = await openEditor();
    expect(screen.queryByText("Unsaved changes")).toBeNull();
    form().values.customer = "Acme";
    await settle();
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(form().values.customer).toBe("");
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it("asks before leaving with edits", async () => {
    const { form, router } = await openEditor();
    form().values.customer = "Acme";
    await settle();
    const navigation = router.push("/offers");
    await settle();
    expect(screen.getByRole("alertdialog").textContent).toContain("Unsaved changes");
    await fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));
    await navigation;
    expect(router.currentRoute.value.path).toBe("/editor");
  });

  it("after a refused submit counts the errors per section, reveals the first one and focuses its field", async () => {
    const { form } = await openEditor();
    await fireEvent.click(saveButton());
    await settle();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(form().failure.value?.kind).toBe("invalid");
    expect(link("customer").querySelector("[data-test='section-error-count']")?.textContent).toBe("1");
    expect(link("lines").querySelector("[data-test='section-error-count']")?.textContent).toBe("1");
    expect(link("notes").querySelector("[data-test='section-error-count']")).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText(/Customer/));
  });

  it("an error counts down while the user fixes the field", async () => {
    const { form } = await openEditor();
    await fireEvent.click(saveButton());
    await new Promise((resolve) => setTimeout(resolve, 60));
    await fireEvent.update(screen.getByLabelText(/Customer/), "Acme");
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(form().errors.first("customer")).toBeUndefined();
    expect(link("customer").querySelector("[data-test='section-error-count']")).toBeNull();
    expect(link("lines").querySelector("[data-test='section-error-count']")?.textContent).toBe("1");
  });

  it("opens a collapsed section to show its error, when the first error is in it", async () => {
    const { form } = await openEditor({ collapseLines: true });
    form().values.customer = "Acme";
    await settle();
    expect(screen.getByLabelText(/Quantity/).closest("[hidden], [inert], .hidden, [style*='display: none']")).not.toBeNull();
    await fireEvent.click(saveButton());
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(document.activeElement).toBe(screen.getByLabelText(/Quantity/));
  });

  it("a failed save keeps the draft and says why; the form can be saved again", async () => {
    const { form } = await openEditor({
      submit: (f) =>
        f.submit(async () => {
          throw new ApiError({ kind: "server", message: "boom", status: 500 });
        }),
    });
    form().values.customer = "Acme";
    form().values.quantity = 3;
    await fireEvent.click(saveButton());
    await settle();
    expect(form().values.customer).toBe("Acme");
    expect(document.querySelector("[data-test='form-errors']")?.textContent).toContain("could not be saved");
    expect(form().dirty.value).toBe(true);
  });

  it("lists a server error whose field is not on the page, in words, instead of dropping it", async () => {
    const { form } = await openEditor({
      submit: (f) =>
        f.submit(async () => {
          throw new ApiError({ kind: "validation", message: "no", status: 422, fields: { discount_code: ["expired"] } });
        }),
    });
    form().values.customer = "Acme";
    form().values.quantity = 3;
    await fireEvent.click(saveButton());
    await settle();
    expect(document.querySelector("[data-test='form-errors-hidden']")?.textContent).toContain("DISCOUNT_CODE: expired");
  });
});

describe("EditorPage on a phone", () => {
  it("has no section sidebar: the floating jumper is the section control", async () => {
    media.set({ compact: true });
    await openEditor();
    expect(document.querySelector("[data-test='section-list']")).toBeNull();
  });
});
