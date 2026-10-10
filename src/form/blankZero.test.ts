import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import FormGroup from "./FormGroup.vue";
import FormView from "./FormView.vue";
import MoneyField from "./MoneyField.vue";
import NumberField from "./NumberField.vue";
import { useForm } from "./useForm";

afterEach(() => (document.body.innerHTML = ""));
const i18n = createTestI18n();
const plugins = [i18n, testFormatting(i18n)];
const inputOf = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

describe("blankZero", () => {
  it("shows a 0 as an empty field, and keeps showing the 0 that is not blank by default", () => {
    const blank = render(NumberField, { props: { label: "Zero", modelValue: 0, blankZero: true, decimals: 2 }, global: { plugins } });
    expect(inputOf("Zero").value).toBe("");
    blank.unmount(); // two apps would share their generated ids
    render(NumberField, { props: { label: "Zero", modelValue: 0, decimals: 2 }, global: { plugins } });
    expect(inputOf("Zero").value).toBe("0.00");
  });

  it("focusing and leaving a blank 0 changes nothing: no update, still empty", async () => {
    const update = vi.fn();
    render(NumberField, { props: { label: "Cost", modelValue: 0, blankZero: true, "onUpdate:modelValue": update }, global: { plugins } });
    const input = inputOf("Cost");
    await fireEvent.focus(input);
    await fireEvent.blur(input);
    expect(input.value).toBe("");
    expect(update).not.toHaveBeenCalled();
  });

  it("a 0 the user types stays visible while the field has focus, and reads blank once it is left", async () => {
    const value = ref<number | null>(null);
    const Host = defineComponent({ setup: () => () => h(NumberField, { label: "Cost", modelValue: value.value, "onUpdate:modelValue": (next: number | null) => (value.value = next), blankZero: true }) });
    render(Host, { global: { plugins } });
    const input = inputOf("Cost");
    await fireEvent.focus(input);
    await fireEvent.update(input, "0");
    expect(value.value).toBe(0);
    expect(input.value).toBe("0");
    await fireEvent.blur(input);
    expect(input.value).toBe("");
    expect(value.value).toBe(0);
  });

  it("reads as an empty field in read mode too", () => {
    let form!: ReturnType<typeof useForm<{ cost: number | null }>>;
    const Host = defineComponent({
      setup() {
        form = useForm({ defaults: () => ({ cost: 0 as number | null }) });
        return () => h(FormView, { form, editable: false }, () => h(FormGroup, {}, () => h(NumberField, { ...form.bind("cost"), label: "Cost", blankZero: true })));
      },
    });
    const { container } = render(Host, { global: { plugins } });
    expect(container.textContent).not.toContain("0");
  });

  it("MoneyField passes it through", () => {
    render(MoneyField, { props: { label: "Price", currency: "EUR", modelValue: 0, blankZero: true }, global: { plugins } });
    expect(inputOf("Price").value).toBe("");
  });
});
