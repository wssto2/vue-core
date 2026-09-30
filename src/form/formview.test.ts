import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { ApiError } from "../client";
import { provideSectionIndex, type SectionIndex } from "../page";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import { fieldKey, focusFirstError } from "./focus";
import FormErrors from "./FormErrors.vue";
import FormGroup from "./FormGroup.vue";
import FormRow from "./FormRow.vue";
import FormView from "./FormView.vue";
import TextField from "./TextField.vue";
import { settle, withSetup } from "./testing";
import { useForm } from "./useForm";

const i18n = createTestI18n("en");
const global = { plugins: [i18n, testFormatting(i18n)] };

afterEach(() => {
  document.body.innerHTML = "";
});

const empty = () => ({ name: "", email: "", note: "" });

function mountForm(fields: (form: ReturnType<typeof useForm<ReturnType<typeof empty>>>) => unknown, submit = vi.fn()) {
  let form!: ReturnType<typeof useForm<ReturnType<typeof empty>>>;
  const Host = defineComponent({
    setup() {
      form = useForm({ defaults: empty });
      return () => h(FormView, { form, onSubmit: submit, fieldLabel: (key: string) => key.toUpperCase() }, () => fields(form));
    },
  });
  return { ...render(Host, { global }), form: () => form, submit };
}
const reject = (fields: Record<string, string[]>, kind: "validation" | "conflict" = "validation") => new ApiError({ kind, message: "no", status: kind === "conflict" ? 409 : 422, fields });

describe("FormView", () => {
  it("submits on Enter, once, and not while a submit is in flight", async () => {
    const { form, submit, container } = mountForm((f) => h(TextField, { ...f.bind("name"), label: "Name" }));
    await fireEvent.submit(container.querySelector("form")!);
    expect(submit).toHaveBeenCalledTimes(1);
    const gate = form().submit(() => new Promise(() => undefined));
    void gate;
    await nextTick();
    await fireEvent.submit(container.querySelector("form")!);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("does not submit when it reads", async () => {
    const submit = vi.fn();
    const { container } = render(FormView, { props: { editable: false, onSubmit: submit }, global });
    await fireEvent.submit(container.querySelector("form")!);
    expect(submit).not.toHaveBeenCalled();
  });
});

describe("FormErrors", () => {
  it("tells why a submit failed, with the request id to quote", async () => {
    const { form } = mountForm((f) => h(TextField, { ...f.bind("name"), label: "Name" }));
    await form().submit(async () => {
      throw new ApiError({ kind: "forbidden", message: "no", status: 403, requestId: "req-42" });
    });
    await nextTick();
    const banner = document.querySelector("[data-test='form-errors']")!;
    expect(banner.textContent).toContain("You do not have permission to do this.");
    expect(banner.textContent).toContain("Request req-42");
  });

  it("a conflict is a warning that says the record changed; the draft is still there", async () => {
    const { form } = mountForm((f) => h(TextField, { ...f.bind("name"), label: "Name" }));
    form().values.name = "Mine";
    await form().submit(async () => {
      throw reject({}, "conflict");
    });
    await nextTick();
    expect(document.querySelector("[data-test='form-errors']")?.textContent).toContain("changed while you were editing");
    expect(form().values.name).toBe("Mine");
  });

  it("lists an error whose field has no place in the form: a visible form-level error for an unknown server field", async () => {
    const { form } = mountForm((f) => h(TextField, { ...f.bind("name"), label: "Name" }));
    await form().submit(async () => {
      throw reject({ nickname: ["already taken"], name: ["too short"] });
    });
    await settle();
    const hidden = document.querySelector("[data-test='form-errors-hidden']")!;
    expect(hidden.textContent).toContain("NICKNAME: already taken");
    expect(hidden.textContent).not.toContain("too short"); // that one sits on its field
    expect(screen.getAllByRole("alert").some((alert) => alert.textContent?.includes("too short"))).toBe(true);
  });

  it("lists an error on a field of the form that is not on screen (another section, another entry type)", async () => {
    // `email` is in the form but no field for it is rendered
    const { form } = mountForm((f) => h(TextField, { ...f.bind("name"), label: "Name" }));
    await form().submit(async () => {
      throw reject({ email: ["invalid e-mail"] });
    });
    await settle();
    expect(document.querySelector("[data-test='form-errors-hidden']")?.textContent).toContain("EMAIL: invalid e-mail");
  });

  it("stops listing an error once its field shows up or is fixed", async () => {
    const { form } = mountForm((f) => [h(TextField, { ...f.bind("name"), label: "Name" }), h(TextField, { ...f.bind("email"), label: "Email" })]);
    await form().submit(async () => {
      throw reject({ email: ["bad"], gone: ["x"] });
    });
    await settle();
    const listed = document.querySelector("[data-test='form-errors-hidden']")!.textContent;
    expect(listed).toContain("GONE");
    expect(listed).not.toContain("EMAIL");
  });

  it("treats a hand-wired field (fieldKey) and a container named after the list as showing the errors of a value inside it", async () => {
    const { form } = mountForm((f) => [
      h(TextField, { modelValue: "", label: "Line", error: "Required", ...fieldKey("lines.0.product") }),
      h("div", { "data-field-key": "tags" }),
      h(TextField, { ...f.bind("name"), label: "Name" }),
    ]);
    await form().submit(async () => {
      throw reject({ "lines.0.product": ["Required"], "tags.1": ["too long"], "lines.1.product": ["nobody shows me"] });
    });
    await settle();
    const listed = document.querySelector("[data-test='form-errors-hidden']")!.textContent;
    expect(listed).toContain("LINES.1.PRODUCT");
    expect(listed).not.toContain("LINES.0.PRODUCT");
    expect(listed).not.toContain("TAGS.1");
  });

  it("renders nothing for a form with nothing to say", () => {
    mountForm((f) => h(TextField, { ...f.bind("name"), label: "Name" }));
    expect(document.querySelector("[data-test='form-errors']")).toBeNull();
  });

  it("works on its own over any form", async () => {
    const form = withSetup(() => useForm({ defaults: empty })).result;
    form.errors.set({ "": ["The whole form is invalid"] });
    render(FormErrors, { props: { form }, global });
    await settle();
    expect(screen.getByText(/The whole form is invalid/)).toBeTruthy();
  });
});

describe("focusFirstError", () => {
  it("focuses the control of the first field with an error, and says whether there was one", async () => {
    const { form } = mountForm((f) => [h(TextField, { ...f.bind("name"), label: "Name" }), h(TextField, { ...f.bind("email"), label: "Email" })]);
    expect(await focusFirstError()).toBe(false);
    form().errors.set({ email: ["bad"] });
    await nextTick();
    expect(await focusFirstError()).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText("Email"));
  });

  it("skips a locked (disabled) control", async () => {
    const { form } = mountForm((f) => [h(TextField, { ...f.bind("name"), label: "Name", disabled: true }), h(TextField, { ...f.bind("email"), label: "Email" })]);
    form().errors.set({ name: ["x"], email: ["y"] });
    await nextTick();
    await focusFirstError();
    expect(document.activeElement).toBe(screen.getByLabelText("Email"));
  });
});

describe("FormGroup and FormRow", () => {
  it("says why rows are locked once, under the group, only while one is locked", async () => {
    const { rerender } = render(FormGroup, {
      props: { header: "Identification", lockedFooter: "These come from the import." },
      slots: { default: () => h(TextField, { modelValue: "x", label: "VIN", disabled: true }) },
      global,
    });
    await nextTick();
    expect(screen.getByText("These come from the import.")).toBeTruthy();
    await rerender({ header: "Identification", lockedFooter: "These come from the import." });
    expect(screen.getByText("Identification")).toBeTruthy();
  });

  it("does not say it when nothing is locked", () => {
    render(FormGroup, { props: { lockedFooter: "These come from the import." }, slots: { default: () => h(TextField, { modelValue: "x", label: "VIN" }) }, global });
    expect(screen.queryByText("These come from the import.")).toBeNull();
  });

  it("a group with `section` is listed in the page's section index under its header", async () => {
    const captured: { index?: SectionIndex } = {};
    const Page = defineComponent({
      setup() {
        captured.index = provideSectionIndex();
        return () => h("div", [h(FormGroup, { header: "Contact details", section: true }, () => h(TextField, { modelValue: "x", label: "Email" })), h(FormGroup, { header: "Address", section: true }, () => h(TextField, { modelValue: "y", label: "Street" }))]);
      },
    });
    render(Page, { global });
    await settle();
    expect(captured.index?.sections.value.map((section) => [section.id, section.label])).toEqual([
      ["contact-details", "Contact details"],
      ["address", "Address"],
    ]);
  });

  it("a custom row shows a value and its own error", () => {
    render(FormRow, { props: { label: "Total", value: "12", error: "Too low" }, global });
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Too low");
  });
});
