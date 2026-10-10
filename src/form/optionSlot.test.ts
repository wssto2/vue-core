import { fireEvent, render, screen, within } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, ref, type Component } from "vue";
import { settle } from "../testing";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import { recentChoicesKey } from "./suggestions";
import ComboField from "./ComboField.vue";
import MultiSelectField from "./MultiSelectField.vue";
import type { OptionSlotScope, SelectOption } from "./options";
import SelectField from "./SelectField.vue";

const i18n = createTestI18n();
const global = { plugins: [i18n, testFormatting(i18n)], stubs: { transition: false } };
afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
});

const people: readonly SelectOption<number>[] = [
  { value: 1, label: "Ann", description: "ann@example.com" },
  { value: 2, label: "Bob" },
  { value: 3, label: "Cy" },
];

/** The `#option` slot of the tests: a badge per row that says the state the slot was given. */
const badge = ({ option, active, selected }: OptionSlotScope<number>) => h("span", { "data-testid": "badge" }, `${option.label}|${active ? "active" : "idle"}|${selected ? "selected" : "free"}`);

function mount(component: Component, props: Record<string, unknown>, initial: unknown, slot = true) {
  const model = ref<unknown>(initial);
  const Host = defineComponent({ setup: () => () => h(component, { ...props, modelValue: model.value, "onUpdate:modelValue": (value: unknown) => (model.value = value) }, slot ? { option: badge } : {}) });
  return { ...render(Host, { global }), model };
}
const badges = () => screen.getAllByTestId("badge").map((node) => node.textContent);
const openSelect = async (label: string) => {
  await fireEvent.click(screen.getByLabelText(label));
  await settle();
};

describe("#option on ComboField", () => {
  it("replaces the row's content, keeps the row's role, aria and keys, and says which row is active and chosen", async () => {
    const { model } = mount(ComboField, { label: "Customer", options: people }, null);
    const input = screen.getByRole("combobox");
    await fireEvent.focus(input);
    expect(badges()).toEqual(["Ann|active|free", "Bob|idle|free", "Cy|idle|free"]);
    expect(screen.queryByText("ann@example.com")).toBeNull(); // the default label and description are replaced
    const rows = screen.getAllByRole("option");
    expect(rows.map((row) => row.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    expect(input.getAttribute("aria-activedescendant")).toBe(rows[0]!.id);
    await fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(badges()).toEqual(["Ann|idle|free", "Bob|active|free", "Cy|idle|free"]);
    await fireEvent.keyDown(input, { key: "Enter" });
    expect(model.value).toBe(2);
    await fireEvent.focus(input);
    expect(badges()).toContain("Bob|idle|selected");
  });

  it("without a slot the row says what it always said", async () => {
    mount(ComboField, { label: "Customer", options: people }, null, false);
    await fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.queryAllByTestId("badge")).toHaveLength(0);
    expect(screen.getByText("ann@example.com")).toBeTruthy();
  });
});

describe("#option on SelectField", () => {
  it("replaces the row's content, keeps the option role, the chosen mark and arrow keys, and a click picks", async () => {
    const { model } = mount(SelectField, { label: "Person", options: people }, 2);
    await openSelect("Person");
    const list = within(screen.getByRole("dialog"));
    expect(list.getAllByTestId("badge").map((node) => node.textContent)).toEqual(["Ann|active|free", "Bob|idle|selected", "Cy|idle|free"]);
    const options = list.getAllByRole("option");
    expect(options.map((option) => option.getAttribute("aria-selected"))).toEqual(["false", "true", "false"]);
    const buttons = options.map((option) => option.querySelector("button")!);
    buttons[0]!.focus();
    await fireEvent.keyDown(buttons[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(buttons[1]);
    await fireEvent.focus(buttons[1]!);
    expect(list.getAllByTestId("badge")[1]!.textContent).toBe("Bob|active|selected");
    await fireEvent.click(buttons[2]!);
    expect(model.value).toBe(3);
  });
});

describe("#option on MultiSelectField", () => {
  it("replaces the row's content and keeps the toggling and aria-selected", async () => {
    const { model } = mount(MultiSelectField, { label: "People", options: people }, [1]);
    await openSelect("People");
    const list = within(screen.getByRole("dialog"));
    expect(list.getAllByTestId("badge").map((node) => node.textContent)).toEqual(["Ann|active|selected", "Bob|idle|free", "Cy|idle|free"]); // the popover moves the keyboard to the first row
    await fireEvent.click(list.getAllByRole("option")[2]!.querySelector("button")!);
    expect(model.value).toEqual([1, 3]);
    expect(within(screen.getByRole("dialog")).getAllByRole("option").map((option) => option.getAttribute("aria-selected"))).toEqual(["true", "false", "true"]);
  });
});

describe("meta", () => {
  it("is kept with a recent choice, so the slot can read it on the recent rows", async () => {
    const saved: Record<string, readonly SelectOption<string | number>[]> = {};
    const store = { read: (id: string) => saved[id] ?? [], write: (id: string, choices: readonly SelectOption<string | number>[]) => void (saved[id] = choices) };
    const withMeta: readonly SelectOption<number, { vin: string }>[] = [{ value: 1, label: "Clio", meta: { vin: "VF1" } }];
    const model = ref<unknown>(null);
    const Host = defineComponent({ setup: () => () => h(ComboField as Component, { label: "Car", options: withMeta, recents: "cars", modelValue: model.value, "onUpdate:modelValue": (value: unknown) => (model.value = value) }) });
    render(Host, { global: { ...global, provide: { [recentChoicesKey as symbol]: store } } });
    await fireEvent.focus(screen.getByRole("combobox"));
    await fireEvent.click(screen.getAllByRole("option")[0]!);
    expect(saved.cars).toEqual([{ value: 1, label: "Clio", meta: { vin: "VF1" } }]);
  });
});
