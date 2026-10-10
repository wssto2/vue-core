import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, type Component } from "vue";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import { mockMedia } from "../testing/media";
import ComboField from "./ComboField.vue";
import FormGroup from "./FormGroup.vue";
import FormView from "./FormView.vue";
import type { SelectOption, ValueSlotScope } from "./index";
import SelectField from "./SelectField.vue";
import { useForm } from "./useForm";

const i18n = createTestI18n();
const global = { plugins: [i18n, testFormatting(i18n)], stubs: { transition: false } };
let media: ReturnType<typeof mockMedia> | undefined;
afterEach(() => {
  media?.restore();
  media = undefined;
  document.body.innerHTML = "";
  document.body.className = "";
});

const colours: readonly SelectOption<number, { hex: string }>[] = [
  { value: 1, label: "Red", meta: { hex: "#f00" } },
  { value: 2, label: "Blue", meta: { hex: "#00f" } },
];
const swatch = ({ option }: ValueSlotScope<number, { hex: string }>) => h("span", { "data-testid": "chosen", "data-hex": option.meta.hex }, `swatch ${option.label}`);

const mountField = (component: Component, value: number | null, slot = true) =>
  render(component, { props: { label: "Colour", options: colours, modelValue: value }, slots: slot ? { value: swatch } : {}, global });

/** The field read-only in a group, as a record's read page shows it. */
function mountRead(component: Component, value: number | null) {
  const Host = defineComponent({
    setup() {
      const form = useForm({ defaults: () => ({ colour: value }) });
      return () => h(FormView, { form, editable: false }, () => h(FormGroup, {}, () => h(component, { ...form.bind("colour"), label: "Colour", options: colours }, { value: swatch })));
    },
  });
  return render(Host, { global });
}

describe("#value on SelectField", () => {
  it("replaces the chosen value's text with the slot, given the chosen option and its meta", () => {
    const { container } = mountField(SelectField, 2);
    expect(screen.getByTestId("chosen").getAttribute("data-hex")).toBe("#00f");
    expect(container.textContent).toContain("swatch Blue"); // the slot's text, not the bare label
  });

  it("on a phone too", () => {
    media = mockMedia({ compact: true });
    mountField(SelectField, 1);
    expect(screen.getByTestId("chosen").getAttribute("data-hex")).toBe("#f00");
  });

  it("is not used for the placeholder, and without the slot the text is the label", () => {
    const empty = mountField(SelectField, null);
    expect(screen.queryByTestId("chosen")).toBeNull();
    expect(empty.container.textContent).toContain("Choose");
    empty.unmount();
    const plain = mountField(SelectField, 1, false);
    expect(plain.container.textContent).toContain("Red");
  });

  it("is the read-mode value too", () => {
    mountRead(SelectField, 1);
    expect(screen.getByTestId("chosen").textContent).toBe("swatch Red");
  });

  it("shows the options' rows unchanged when opened", async () => {
    mountField(SelectField, 1);
    await fireEvent.click(screen.getByLabelText("Colour"));
    expect(screen.getAllByRole("option").map((row) => row.textContent)).toEqual(["Red", "Blue"]);
  });
});

describe("#value on ComboField", () => {
  it("stands before the text while an option is chosen, and the typed text stays editable", () => {
    mountField(ComboField, 2);
    expect(screen.getByTestId("chosen").getAttribute("data-hex")).toBe("#00f");
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("Blue");
  });

  it("is absent while nothing is chosen", () => {
    mountField(ComboField, null);
    expect(screen.queryByTestId("chosen")).toBeNull();
  });

  it("is the read-mode value too", () => {
    mountRead(ComboField, 2);
    expect(screen.getByTestId("chosen").textContent).toBe("swatch Blue");
  });
});
