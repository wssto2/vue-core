import { render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, type Component } from "vue";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import CardSelectField from "./CardSelectField.vue";
import ChoiceChips from "./ChoiceChips.vue";
import ComboField from "./ComboField.vue";
import DateField from "./DateField.vue";
import DateTimeField from "./DateTimeField.vue";
import FileField from "./FileField.vue";
import FormGroup from "./FormGroup.vue";
import FormView from "./FormView.vue";
import I18nField from "./I18nField.vue";
import MoneyField from "./MoneyField.vue";
import MonthYearField from "./MonthYearField.vue";
import MultiSelectField from "./MultiSelectField.vue";
import NumberField from "./NumberField.vue";
import PhotoField from "./PhotoField.vue";
import SegmentedField from "./SegmentedField.vue";
import SelectField from "./SelectField.vue";
import SwitchField from "./SwitchField.vue";
import TextareaField from "./TextareaField.vue";
import TextField from "./TextField.vue";
import TimeField from "./TimeField.vue";

const i18n = createTestI18n();
const plugins = [i18n, testFormatting(i18n)];
const options = [{ value: 1, label: "One" }, { value: 2, label: "Two" }];

// Every field passes the slots of its `Field` row through: a button after the control, and a custom read-only presentation.
const fields: [string, Component, Record<string, unknown>][] = [
  ["TextField", TextField, {}],
  ["TextareaField", TextareaField, {}],
  ["NumberField", NumberField, {}],
  ["MoneyField", MoneyField, { currency: "EUR" }],
  ["SelectField", SelectField, { options }],
  ["MultiSelectField", MultiSelectField, { options }],
  ["ComboField", ComboField, { options }],
  ["SegmentedField", SegmentedField, { options }],
  ["ChoiceChips", ChoiceChips, { options }],
  ["CardSelectField", CardSelectField, { options }],
  ["DateField", DateField, {}],
  ["DateTimeField", DateTimeField, {}],
  ["TimeField", TimeField, {}],
  ["MonthYearField", MonthYearField, {}],
  ["FileField", FileField, {}],
  ["PhotoField", PhotoField, {}],
  ["SwitchField", SwitchField, {}],
  ["I18nField", I18nField, { locales: ["en", "hr"] }],
];

afterEach(() => {
  document.body.innerHTML = "";
});

function mountField(component: Component, props: Record<string, unknown>, inGroup: boolean) {
  const field = () => h(component, { label: "Field", ...props }, { trailing: () => h("button", { type: "button" }, "Save row") });
  const Host = defineComponent({ setup: () => () => (inGroup ? h(FormView, { form: undefined as never, editable: true }, () => h(FormGroup, {}, field)) : field()) });
  return render(Host, { global: { plugins } });
}

describe.each([["in a group", true], ["on its own", false]])("a trailing action %s", (_name, inGroup) => {
  it.each(fields)("%s renders it and the keyboard reaches it", (_label, component, props) => {
    mountField(component, props, inGroup);
    const button = screen.getByRole("button", { name: "Save row" });
    expect(button.tabIndex).toBeGreaterThanOrEqual(0);
    button.focus();
    expect(document.activeElement).toBe(button);
  });
});

describe("a trailing action when the form reads", () => {
  it("is not shown, as Field does it", () => {
    const Host = defineComponent({
      setup: () => () => h(FormView, { form: undefined as never, editable: false }, () => h(FormGroup, {}, () => h(SelectField, { label: "Status", options, modelValue: 1 }, { trailing: () => h("button", { type: "button" }, "Save row") }))),
    });
    render(Host, { global: { plugins } });
    expect(screen.queryByRole("button", { name: "Save row" })).toBeNull();
  });
});

describe("the other slots of Field", () => {
  it("a select passes a custom read-only presentation and the label's trailing content through", () => {
    const readOnly = defineComponent({
      setup: () => () => h(FormView, { form: undefined as never, editable: false }, () => h(FormGroup, {}, () => h(SelectField, { label: "Status", options, modelValue: 1 }, { readonly: () => h("em", "Card of One") }))),
    });
    render(readOnly, { global: { plugins } });
    expect(screen.getByText("Card of One")).toBeTruthy();
    document.body.innerHTML = "";

    const editing = defineComponent({
      setup: () => () => h(FormView, { form: undefined as never, editable: true }, () => h(FormGroup, {}, () => h(SelectField, { label: "Status", options }, { labelTrailing: () => h("small", "after the label") }))),
    });
    render(editing, { global: { plugins } });
    expect(screen.getByText("after the label")).toBeTruthy();
  });
});
