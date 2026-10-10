import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Component } from "vue";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import { mockMedia } from "../testing/media";
import ComboField from "./ComboField.vue";
import DateField from "./DateField.vue";
import DateTimeField from "./DateTimeField.vue";
import MoneyField from "./MoneyField.vue";
import NumberField from "./NumberField.vue";
import TextareaField from "./TextareaField.vue";
import TextField from "./TextField.vue";
import TimeField from "./TimeField.vue";

let media: ReturnType<typeof mockMedia>;
beforeEach(() => (media = mockMedia()));
afterEach(() => {
  media.restore();
  document.body.innerHTML = "";
});

const options = [{ value: 1, label: "One" }];
const fields: [string, Component, Record<string, unknown>][] = [
  ["TextField", TextField, {}],
  ["NumberField", NumberField, {}],
  ["MoneyField", MoneyField, { currency: "EUR" }],
  ["TextareaField", TextareaField, {}],
  ["ComboField", ComboField, { options }],
  ["DateField", DateField, {}],
  ["DateTimeField", DateTimeField, {}],
  ["TimeField", TimeField, {}],
];

describe("focus and blur", () => {
  it.each(fields)("%s emits focus and blur as component events, with the DOM event", async (_name, component, props) => {
    const i18n = createTestI18n();
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    render(component, { props: { label: "Field", ...props, onFocus, onBlur }, global: { plugins: [i18n, testFormatting(i18n)] } });
    const input = screen.getByLabelText("Field");
    await fireEvent.focus(input);
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocus.mock.calls[0]![0]).toBeInstanceOf(FocusEvent);
    await fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(onBlur.mock.calls[0]![0]).toBeInstanceOf(FocusEvent);
  });

  it("a typed date is committed before blur is emitted: the listener reads the value", async () => {
    const i18n = createTestI18n({ locale: "en" });
    const seen: (string | null)[] = [];
    const model = { value: null as string | null };
    render(DateField, {
      props: { label: "Day", modelValue: null, "onUpdate:modelValue": (next: string | null) => (model.value = next), onBlur: () => seen.push(model.value) },
      global: { plugins: [i18n, testFormatting(i18n)] },
    });
    const input = screen.getByLabelText("Day");
    await fireEvent.update(input, "2026-09-30");
    await fireEvent.blur(input);
    expect(seen).toEqual(["2026-09-30"]);
  });
});
