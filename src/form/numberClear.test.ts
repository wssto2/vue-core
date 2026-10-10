import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import MoneyField from "./MoneyField.vue";
import NumberField from "./NumberField.vue";

afterEach(() => (document.body.innerHTML = ""));
const i18n = createTestI18n();
const plugins = [i18n, testFormatting(i18n)];

/** Empties the input the way `how` does (Playwright's fill(""), a paste of nothing, a cut of everything, Backspace over a selection). */
const clear: Record<string, (input: HTMLInputElement) => Promise<unknown>> = {
  "input event with an empty value (fill)": (input) => fireEvent.update(input, ""),
  "paste of nothing": async (input) => {
    input.value = "";
    return fireEvent(input, new InputEvent("input", { bubbles: true, inputType: "insertFromPaste", data: "" }));
  },
  "cut": async (input) => {
    input.value = "";
    return fireEvent(input, new InputEvent("input", { bubbles: true, inputType: "deleteByCut" }));
  },
  "backspace over the selection": async (input) => {
    input.value = "";
    return fireEvent(input, new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
  },
};

describe("clearing a NumberField", () => {
  it.each(Object.keys(clear))("emits null when emptied by %s", async (how) => {
    const update = vi.fn();
    render(NumberField, { props: { label: "Qty", modelValue: 5, "onUpdate:modelValue": update }, global: { plugins } });
    const input = screen.getByLabelText("Qty") as HTMLInputElement;
    await fireEvent.focus(input);
    await clear[how]!(input);
    expect(update).toHaveBeenLastCalledWith(null);
  });

  it("keeps a select-all made before the focus (select, then focus): the select event arrives after the formatted text became the typed text, and selects it again", async () => {
    render(NumberField, { props: { label: "Qty", modelValue: 120, decimals: 2 }, global: { plugins } });
    const input = screen.getByLabelText("Qty") as HTMLInputElement;
    expect(input.value).toBe("120.00");
    // Playwright's fill("") does select(), focus() in one task, then presses Delete; the swap collapses the selection in a browser.
    input.select();
    await fireEvent.focus(input);
    input.setSelectionRange(3, 3); // what the browser leaves after the text was swapped
    await fireEvent(input, new Event("select"));
    expect(input.value).toBe("120");
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 3]);
  });

  it("leaves a selection alone once the user has pressed a key", async () => {
    render(NumberField, { props: { label: "Qty", modelValue: 120, decimals: 2 }, global: { plugins } });
    const input = screen.getByLabelText("Qty") as HTMLInputElement;
    await fireEvent.focus(input);
    await fireEvent.keyDown(input, { key: "ArrowLeft" });
    input.setSelectionRange(1, 1);
    await fireEvent(input, new Event("select"));
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 1]);
  });

  it("emits null even when the value it was given is already null: a parent that shows a 0 as empty still hears the clear", async () => {
    const update = vi.fn();
    render(NumberField, { props: { label: "Qty", modelValue: null, "onUpdate:modelValue": update }, global: { plugins } });
    const input = screen.getByLabelText("Qty") as HTMLInputElement;
    await fireEvent.focus(input);
    await fireEvent.update(input, "");
    expect(update).toHaveBeenCalledWith(null);
  });

  it("MoneyField passes the clear on, also over a value shown empty", async () => {
    const update = vi.fn();
    render(MoneyField, { props: { label: "Price", currency: "EUR", modelValue: null, "onUpdate:modelValue": update }, global: { plugins } });
    const input = screen.getByLabelText("Price") as HTMLInputElement;
    await fireEvent.focus(input);
    await fireEvent.update(input, "");
    expect(update).toHaveBeenCalledWith(null);
  });

  it("still works as a v-model on a ref", async () => {
    const value = ref<number | null>(7);
    const Host = defineComponent({ setup: () => () => h(NumberField, { label: "Qty", modelValue: value.value, "onUpdate:modelValue": (next: number | null) => (value.value = next) }) });
    render(Host, { global: { plugins } });
    const input = screen.getByLabelText("Qty") as HTMLInputElement;
    await fireEvent.focus(input);
    await fireEvent.update(input, "");
    expect(value.value).toBeNull();
  });
});
