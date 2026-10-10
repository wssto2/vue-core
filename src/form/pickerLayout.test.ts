import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, type Component } from "vue";
import { settle } from "../testing";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import ComboField from "./ComboField.vue";
import FormGroup from "./FormGroup.vue";
import FormView from "./FormView.vue";
import SelectField from "./SelectField.vue";

const i18n = createTestI18n();
const global = { plugins: [i18n, testFormatting(i18n)], stubs: { transition: false } };
const options = [{ value: 1, label: "Clio" }, { value: 2, label: "Megane" }];
const innerWidth = window.innerWidth;
afterEach(() => {
  document.body.innerHTML = "";
  window.innerWidth = innerWidth;
});

const inRow = (component: Component, props: Record<string, unknown>) =>
  render(defineComponent({ setup: () => () => h(FormView, { editable: true } as never, () => h(FormGroup, {}, () => h(component, { label: "Vehicle", options, ...props }))) }), { global });
const layout = (container: Element) => container.querySelector('[data-test="form-row"]')?.getAttribute("data-layout");

describe("rowLayout on pickers", () => {
  it.each([["ComboField", ComboField], ["SelectField", SelectField]] as const)("%s: no option keeps the label column, setting and stacked lay the row out", (_name, component) => {
    expect(layout(inRow(component, {}).container)).toBe("entry");
    document.body.innerHTML = "";
    expect(layout(inRow(component, { rowLayout: "setting" }).container)).toBe("setting");
    document.body.innerHTML = "";
    expect(layout(inRow(component, { rowLayout: "stacked" }).container)).toBe("stacked");
  });

  it("a stacked ComboField and SelectField fill the row under the label", () => {
    const combo = inRow(ComboField, { rowLayout: "stacked" });
    expect(combo.container.querySelector("input")!.parentElement!.classList.contains("w-full")).toBe(true);
    document.body.innerHTML = "";
    expect(combo.container.querySelector("input")!.className).not.toContain("compact:text-right"); // under its label the text starts at the left, on a phone too
    document.body.innerHTML = "";
    const select = inRow(SelectField, { rowLayout: "stacked" });
    expect(select.container.querySelector("button")!.classList.contains("w-full")).toBe(true);
  });
});

describe("the list under a ComboField", () => {
  async function open() {
    inRow(ComboField, { options });
    await fireEvent.focus(screen.getByRole("combobox"));
    await settle();
    return screen.getByRole("listbox");
  }

  it("is at least 20rem wide, never wider than the screen, wherever the field sits", async () => {
    window.innerWidth = 1024;
    const list = await open();
    expect(list.style.minWidth).toBe("min(20rem, calc(100vw - 16px))");
  });

  it("spans the screen on a phone, so a row keeps its photo and badge", async () => {
    window.innerWidth = 390;
    const list = await open();
    expect(list.style.width).toBe("374px");
    expect(list.style.minWidth).toBe("");
  });
});
