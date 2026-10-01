import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref, type Component } from "vue";
import { createTestI18n } from "../testing/i18n";
import { testFormatting } from "../testing/format";
import { mockMedia } from "../testing/media";
import CardSelectField from "./CardSelectField.vue";
import CheckboxField from "./CheckboxField.vue";
import ChoiceChips from "./ChoiceChips.vue";
import FormGroup from "./FormGroup.vue";
import FormView from "./FormView.vue";
import MoneyField from "./MoneyField.vue";
import NumberCell from "./NumberCell.vue";
import NumberField from "./NumberField.vue";
import OtpInput from "./OtpInput.vue";
import SegmentedField from "./SegmentedField.vue";
import SwitchField from "./SwitchField.vue";
import TextareaField from "./TextareaField.vue";
import TextField from "./TextField.vue";
import { useForm } from "./useForm";

const i18n = createTestI18n("en");
const plugins = [i18n, testFormatting(i18n)];

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
});

/** A field on its own, with its v-model as a spy. */
function mount(component: Component, props: Record<string, unknown> = {}) {
  const update = vi.fn();
  const view = render(component, { props: { ...props, "onUpdate:modelValue": update }, global: { plugins } });
  return { ...view, update };
}

/** A form of fields inside one group, bound with `form.bind()` as an app would. */
function mountGroup(fields: (form: ReturnType<typeof makeForm>) => unknown, options: { editable?: boolean; group?: Record<string, unknown> } = {}) {
  let form!: ReturnType<typeof makeForm>;
  const Host = defineComponent({
    setup() {
      form = makeForm();
      return () => h(FormView, { form, editable: options.editable ?? true }, () => h(FormGroup, options.group ?? {}, () => fields(form)));
    },
  });
  return { ...render(Host, { global: { plugins } }), form: () => form };
}
const makeForm = () =>
  useForm({ defaults: () => ({ name: "", age: null as number | null, on: false, status: null as string | null, notes: "", when: null as string | null }) });

describe("TextField", () => {
  it("is a labelled input bound to its value", async () => {
    const { update } = mount(TextField, { modelValue: "Ann", label: "Name" });
    const input = screen.getByLabelText("Name") as HTMLInputElement;
    expect(input.value).toBe("Ann");
    await fireEvent.update(input, "Anna");
    expect(update).toHaveBeenCalledWith("Anna");
  });

  it("shows its error as an alert the input is described by, and marks the field for the page", () => {
    const { container } = mount(TextField, { modelValue: "", label: "Name", error: "Required", required: true });
    const input = screen.getByLabelText(/Name/) as HTMLInputElement;
    expect(screen.getByRole("alert").textContent).toContain("Required");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toContain("Required");
    expect(container.querySelector("[data-field-error]")).not.toBeNull();
    expect(container.querySelector("[data-field-required]")).not.toBeNull();
    expect(input.required).toBe(true);
  });

  it("counts a required field as filled once it has a value", () => {
    const { container } = mount(TextField, { modelValue: "x", label: "Name", required: true });
    expect(container.querySelector("[data-field-filled]")).not.toBeNull();
  });

  it("a locked field in a group keeps its control, disabled, and is not counted as required", () => {
    const { container } = mountGroup((form) => h(TextField, { ...form.bind("name"), label: "VIN", disabled: true, required: true, lockedReason: "Supplied by VEGA" }));
    expect((screen.getByLabelText("VIN") as HTMLInputElement).disabled).toBe(true);
    expect(container.querySelector("[data-field-locked]")).not.toBeNull();
    expect(container.querySelector("[data-field-required]")).toBeNull();
    expect(container.textContent).toContain("Supplied by VEGA");
  });

  it("reads as a value row when the form does not edit, and hides an empty one", () => {
    const { container, form } = mountGroup(
      (f) => [h(TextField, { ...f.bind("name"), label: "Name" }), h(TextField, { ...f.bind("notes"), label: "Notes" })],
      { editable: false },
    );
    form().values.name = "Ann";
    return nextTick().then(() => {
      expect(container.querySelector("input")).toBeNull();
      expect(container.textContent).toContain("Name");
      expect(container.textContent).toContain("Ann");
      expect(container.textContent).not.toContain("Notes");
    });
  });

  it("a read-only group inside an editing form reads only itself (and follows the prop when it changes)", async () => {
    const editable = ref(false);
    const Host = defineComponent({
      setup() {
        const form = makeForm();
        form.values.name = "Ann";
        return () => h(FormView, { form }, () => h(FormGroup, { editable: editable.value }, () => h(TextField, { ...form.bind("name"), label: "Name" })));
      },
    });
    const { container } = render(Host, { global: { plugins } });
    expect(container.querySelector("input")).toBeNull();
    editable.value = true;
    await nextTick();
    expect(container.querySelector("input")).not.toBeNull();
  });

  it("shows prefix and suffix as plain text, never as markup", () => {
    const { container } = mount(TextField, { modelValue: "", label: "Site", prefix: "<b>@</b>" });
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<b>@</b>");
  });

  it("stands on its own outside a group with its hint under it", () => {
    mount(TextField, { modelValue: "", label: "Name", hint: "As on the ID" });
    expect(screen.getByText("As on the ID")).toBeTruthy();
    expect((screen.getByLabelText("Name") as HTMLInputElement).getAttribute("aria-describedby")).toBeTruthy();
  });
});

describe("a form's fields", () => {
  it("edit the draft through bind(), and a change clears that field's message", async () => {
    const { form } = mountGroup((f) => [h(TextField, { ...f.bind("name"), label: "Name" }), h(NumberField, { ...f.bind("age"), label: "Age" })]);
    form().errors.set({ name: ["Required"], age: ["Too low"] });
    await nextTick();
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    await fireEvent.update(screen.getByLabelText("Name"), "Ann");
    expect(form().values.name).toBe("Ann");
    expect(form().errors.first("name")).toBeUndefined();
    expect(form().errors.first("age")).toBe("Too low");
    expect(form().dirty.value).toBe(true);
  });

  it("carries the field's key to the rendered row, so an error whose field is not on screen can be told apart", () => {
    const { container } = mountGroup((f) => h(TextField, { ...f.bind("name"), label: "Name" }));
    expect(container.querySelector('[data-field-key="name"]')).not.toBeNull();
  });
});

describe("TextareaField", () => {
  it("counts characters against the maximum", async () => {
    const { update } = mount(TextareaField, { modelValue: "abc", label: "Note", maxLength: 10 });
    expect(screen.getByText("3 / 10")).toBeTruthy();
    await fireEvent.update(screen.getByLabelText("Note"), "abcd");
    expect(update).toHaveBeenCalledWith("abcd");
  });
});

describe("NumberField", () => {
  it("reads what the user types in the locale's way and emits a number, rounded to the decimals", async () => {
    const { update } = mount(NumberField, { modelValue: null, label: "Weight", decimals: 2 });
    const input = screen.getByLabelText("Weight") as HTMLInputElement;
    await fireEvent.focus(input);
    await fireEvent.update(input, "1.239");
    expect(update).toHaveBeenLastCalledWith(1.24);
    await fireEvent.update(input, "1,239"); // in the test locale (en) a comma followed by three digits groups thousands
    expect(update).toHaveBeenLastCalledWith(1239);
    await fireEvent.update(input, "");
    expect(update).toHaveBeenLastCalledWith(null);
  });

  it("does not rewrite the text under the cursor while editing, and formats it when the field is left", async () => {
    const value = ref<number | null>(null);
    const Host = defineComponent({ setup: () => () => h(NumberField, { modelValue: value.value, "onUpdate:modelValue": (next: number | null) => (value.value = next), label: "Sum", decimals: 2 }) });
    render(Host, { global: { plugins } });
    const input = screen.getByLabelText("Sum") as HTMLInputElement;
    await fireEvent.focus(input);
    await fireEvent.update(input, "1234,");
    expect(input.value).toBe("1234,");
    await fireEvent.update(input, "1234,5");
    expect(value.value).toBe(1234.5);
    expect(input.value).toBe("1234,5");
    await fireEvent.blur(input);
    expect(input.value).toBe("1,234.50"); // the test locale is en
  });

  it("keeps out what cannot be part of a number, and a minus sign unless negative numbers are allowed", async () => {
    const { update } = mount(NumberField, { modelValue: null, label: "Qty" });
    const input = screen.getByLabelText("Qty") as HTMLInputElement;
    await fireEvent.update(input, "a1b-2");
    expect(input.value).toBe("12");
    expect(update).toHaveBeenLastCalledWith(12);
  });

  it("follows a reset of the value from outside", async () => {
    const value = ref<number | null>(5);
    const Host = defineComponent({ setup: () => () => h(NumberField, { modelValue: value.value, label: "Qty" }) });
    render(Host, { global: { plugins } });
    const input = screen.getByLabelText("Qty") as HTMLInputElement;
    expect(input.value).toBe("5");
    value.value = 9;
    await nextTick();
    expect(input.value).toBe("9");
    value.value = null;
    await nextTick();
    expect(input.value).toBe("");
  });

  it("reads 0 as 0, not as empty (ARV's falsy check hid a zero)", () => {
    const { container } = mountGroup((f) => h(NumberField, { ...f.bind("age"), label: "Age" }), { editable: false });
    expect(container.textContent).not.toContain("0");
    const zero = mountGroup((f) => { f.values.age = 0; return h(NumberField, { ...f.bind("age"), label: "Age" }); }, { editable: false });
    expect(zero.container.textContent).toContain("0");
  });

  it("MoneyField is a number with two decimals and the currency after it", async () => {
    const { update, container } = mount(MoneyField, { modelValue: 1234.5, label: "Price", currency: "EUR" });
    expect(container.textContent).toContain("EUR");
    expect((screen.getByLabelText("Price") as HTMLInputElement).value).toBe("1,234.50");
    await fireEvent.update(screen.getByLabelText("Price"), "99.999");
    expect(update).toHaveBeenLastCalledWith(100);
  });
});

describe("NumberCell", () => {
  it("keeps what is typed to digits between the limits, and empty is null", async () => {
    const { update } = mount(NumberCell, { modelValue: null, label: "Split, March", max: 50 });
    const input = screen.getByLabelText("Split, March") as HTMLInputElement;
    await fireEvent.update(input, "1a2");
    expect(update).toHaveBeenLastCalledWith(12);
    await fireEvent.update(input, "999");
    expect(update).toHaveBeenLastCalledWith(50);
    await fireEvent.update(input, "");
    expect(update).toHaveBeenLastCalledWith(null);
  });
});

describe("SwitchField", () => {
  it("toggles a boolean and says its state to assistive technology", async () => {
    const { update } = mount(SwitchField, { modelValue: false, label: "Newsletter" });
    const toggle = screen.getByRole("switch", { name: "Newsletter" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    await fireEvent.click(toggle);
    expect(update).toHaveBeenCalledWith(true);
  });

  it("does not toggle while locked", async () => {
    const { update } = mount(SwitchField, { modelValue: false, label: "Newsletter", disabled: true });
    await fireEvent.click(screen.getByRole("switch"));
    expect(update).not.toHaveBeenCalled();
  });

  it("reads Yes or No", () => {
    const off = mountGroup((f) => h(SwitchField, { ...f.bind("on"), label: "On" }), { editable: false });
    expect(off.container.textContent).toContain("No");
  });
});

describe("CheckboxField", () => {
  it("is a checkbox row that toggles with click and keyboard", async () => {
    const { update } = mount(CheckboxField, { modelValue: false, label: "ABS", description: "+ 120 EUR" });
    const box = screen.getByRole("checkbox", { name: /ABS/ });
    await fireEvent.click(box);
    expect(update).toHaveBeenLastCalledWith(true);
    await fireEvent.keyDown(box, { key: " " });
    expect(update).toHaveBeenCalledTimes(2);
    expect(screen.getByText("+ 120 EUR")).toBeTruthy();
  });

  it("shows its error", () => {
    mount(CheckboxField, { modelValue: false, label: "Terms", error: "Accept the terms" });
    expect(screen.getByRole("alert").textContent).toContain("Accept the terms");
  });
});

describe("SegmentedField, ChoiceChips and CardSelectField", () => {
  const options = [
    { value: "mail", label: "Mail", count: 3 },
    { value: "phone", label: "Phone" },
  ];

  it("a segmented control picks one, with a count on an option", async () => {
    const { update } = mount(SegmentedField, { modelValue: "mail", label: "Channel", options });
    expect(screen.getByRole("button", { name: /Mail/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("3")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Phone" }));
    expect(update).toHaveBeenCalledWith("phone");
  });

  it("compares strictly: the number 1 is not the text '1'", () => {
    mount(SegmentedField, { modelValue: 1, label: "Level", options: [{ value: "1", label: "One" }] });
    expect(screen.getByRole("button", { name: "One" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("chips toggle independent choices", async () => {
    const { update } = mount(ChoiceChips, { modelValue: ["mail"], label: "Channels", options });
    await fireEvent.click(screen.getByRole("button", { name: "Phone" }));
    expect(update).toHaveBeenLastCalledWith(["mail", "phone"]);
    await fireEvent.click(screen.getByRole("button", { name: "Mail" }));
    expect(update).toHaveBeenLastCalledWith([]);
  });

  it("cards are radios", async () => {
    const { update } = mount(CardSelectField, { modelValue: null, label: "Method", options: [{ value: "a", label: "Alpha", description: "First" }, { value: "b", label: "Beta" }] });
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    await fireEvent.click(screen.getByRole("radio", { name: /Beta/ }));
    expect(update).toHaveBeenCalledWith("b");
  });
});

describe("OtpInput", () => {
  it("keeps only digits, fills the cells, and completes on the last one", async () => {
    const complete = vi.fn();
    const { container } = render(OtpInput, { props: { modelValue: "", length: 6, onComplete: complete }, global: { plugins } });
    const input = screen.getByLabelText("Verification code, 6 digits") as HTMLInputElement;
    await fireEvent.update(input, "12a3");
    expect(input.value).toBe("123");
    expect(complete).not.toHaveBeenCalled();
    expect(container.querySelectorAll("[data-test='otp-input-cell']")).toHaveLength(6);
    await fireEvent.update(input, "123456");
    expect(complete).toHaveBeenCalledWith("123456");
  });

  it("takes a pasted code with separators", async () => {
    const update = vi.fn();
    render(OtpInput, { props: { modelValue: "", "onUpdate:modelValue": update }, global: { plugins } });
    const input = screen.getByLabelText(/Verification code/);
    await fireEvent.paste(input, { clipboardData: { getData: () => "123-456" } });
    expect(update).toHaveBeenLastCalledWith("123456");
  });
});

describe("OtpInput states", () => {
  it("marks the input invalid and disabled when asked, and a cleared model empties the cells", async () => {
    const { rerender, container } = render(OtpInput, { props: { modelValue: "123", invalid: true, disabled: true, label: "Code" }, global: { plugins } });
    const input = screen.getByLabelText("Code") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    await rerender({ modelValue: "" });
    expect(input.value).toBe("");
    expect(container.querySelectorAll("[data-test='otp-input-cell']")[0]?.textContent?.trim()).toBe("");
  });
});

describe("compact presentation", () => {
  it("a media mock can switch a field to its phone look without errors", async () => {
    const media = mockMedia({ compact: true });
    mount(TextField, { modelValue: "", label: "Name" });
    expect(screen.getByLabelText("Name")).toBeTruthy();
    media.restore();
  });
});
