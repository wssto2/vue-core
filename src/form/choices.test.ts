import { fireEvent, render, screen, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref, type Component } from "vue";
import { ApiError } from "../client";
import { deferred } from "../platform/testing";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import { mockMedia } from "../testing/media";
import ComboField from "./ComboField.vue";
import MultiSelectField from "./MultiSelectField.vue";
import OptionList from "./OptionList.vue";
import SelectField from "./SelectField.vue";
import { settle } from "../testing";
import { groupOptions, matchOptions, type SelectOption } from "./options";

const i18n = createTestI18n();
const global = { plugins: [i18n, testFormatting(i18n)], stubs: { transition: false } };

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
});

const statuses: readonly SelectOption<string | number>[] = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: 0, label: "Zero" },
  { value: "", label: "Blank" },
];

/** A select with its model in a ref, so a pick shows. */
function mountSelect(component: Component, props: Record<string, unknown>, initial: unknown = null) {
  const model = ref<unknown>(initial);
  const Host = defineComponent({ setup: () => () => h(component, { ...props, modelValue: model.value, "onUpdate:modelValue": (value: unknown) => (model.value = value) }) });
  return { ...render(Host, { global }), model };
}

describe("options", () => {
  it("groups in order of first appearance, ungrouped first", () => {
    const groups = groupOptions([
      { value: 1, label: "a", group: "B" },
      { value: 2, label: "b" },
      { value: 3, label: "c", group: "A" },
      { value: 4, label: "d", group: "B" },
    ]);
    expect(groups.map((group) => [group.title, group.options.map((option) => option.value)])).toEqual([
      [null, [2]],
      ["B", [1, 4]],
      ["A", [3]],
    ]);
  });

  it("matches ignoring case and accents", () => {
    expect(matchOptions([{ value: 1, label: "Šibenik" }, { value: 2, label: "Zadar" }], "sib").map((option) => option.value)).toEqual([1]);
  });
});

describe("OptionList", () => {
  it("lists the options, marks the chosen one, and emits the picked value", async () => {
    const select = vi.fn();
    render(OptionList, { props: { options: statuses, modelValue: "closed", onSelect: select }, global });
    expect(screen.getByRole("option", { name: "Closed" }).getAttribute("aria-selected")).toBe("true");
    await fireEvent.click(screen.getByRole("option", { name: "Open" }).querySelector("button")!);
    expect(select).toHaveBeenCalledWith("open");
  });

  it("shows a search box from nine options and filters", async () => {
    const many = Array.from({ length: 12 }, (_, index) => ({ value: index, label: `Item ${index}` }));
    render(OptionList, { props: { options: many }, global });
    await fireEvent.update(screen.getByRole("searchbox"), "item 11");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await fireEvent.update(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText("No matches")).toBeTruthy();
  });

  it("moves between rows with the arrow keys", async () => {
    render(OptionList, { props: { options: statuses }, global });
    const buttons = screen.getAllByRole("option").map((row) => row.querySelector("button")!);
    buttons[0]!.focus();
    await fireEvent.keyDown(buttons[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(buttons[1]);
    await fireEvent.keyDown(buttons[1]!, { key: "End" });
    expect(document.activeElement).toBe(buttons[3]);
  });
});

describe("SelectField (wide screens)", () => {
  it("opens its options in a popover and picks one", async () => {
    const { model } = mountSelect(SelectField, { label: "Status", options: statuses });
    const trigger = screen.getByLabelText("Status");
    expect(trigger.textContent).toContain("Choose…");
    await fireEvent.click(trigger);
    await settle();
    await fireEvent.click(within(screen.getByRole("dialog")).getByRole("option", { name: "Closed" }).querySelector("button")!);
    expect(model.value).toBe("closed");
    expect(screen.getAllByLabelText("Status")[0]!.textContent).toContain("Closed");
  });

  it("can choose the value 0 and the empty text: only null is 'no value' (ARV treated 0 as unselected)", async () => {
    const { model } = mountSelect(SelectField, { label: "Status", options: statuses }, null);
    await fireEvent.click(screen.getByLabelText("Status"));
    await settle();
    await fireEvent.click(within(screen.getByRole("dialog")).getByRole("option", { name: "Zero" }).querySelector("button")!);
    expect(model.value).toBe(0);
    expect(screen.getAllByLabelText("Status")[0]!.textContent).toContain("Zero");
  });

  it("compares strictly: a stored '1' does not select the option 1", () => {
    mountSelect(SelectField, { label: "Level", options: [{ value: 1, label: "One" }] }, "1");
    expect(screen.getByLabelText("Level").textContent).toContain("Choose…");
  });

  it("can be cleared when allowed", async () => {
    const { model } = mountSelect(SelectField, { label: "Status", options: statuses, clearable: true }, "open");
    await fireEvent.click(screen.getByLabelText("Status"));
    await settle();
    await fireEvent.click(within(screen.getByRole("dialog")).getByRole("option", { name: "Clear" }).querySelector("button")!);
    expect(model.value).toBeNull();
  });

  it("lists in a panel at least as wide as the field", async () => {
    const measure = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 460, height: 30, x: 0, y: 0, top: 0, left: 0, right: 460, bottom: 30, toJSON: () => ({}) });
    mountSelect(SelectField, { label: "Status", options: statuses });
    await fireEvent.click(screen.getByLabelText("Status"));
    await vi.waitFor(() => expect(screen.getByRole("dialog").style.minWidth).toBe("460px"));
    measure.mockRestore();
  });

  it("does not open while locked, and reads the label as a value", () => {
    mountSelect(SelectField, { label: "Status", options: statuses, disabled: true }, "open");
    expect((screen.getByLabelText("Status") as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows its error", () => {
    mountSelect(SelectField, { label: "Status", options: statuses, error: "Required" });
    expect(screen.getByRole("alert").textContent).toContain("Required");
    expect(screen.getByLabelText("Status").getAttribute("aria-invalid")).toBe("true");
  });
});

describe("SelectField (phones)", () => {
  it("opens its options in a bottom sheet and picks one, which closes it", async () => {
    const media = mockMedia({ compact: true });
    const { model } = mountSelect(SelectField, { label: "Status", options: statuses });
    await fireEvent.click(screen.getByLabelText("Status"));
    await settle();
    const sheet = screen.getByRole("dialog");
    expect(sheet.textContent).toContain("Closed");
    await fireEvent.click(within(sheet).getByRole("option", { name: "Closed" }).querySelector("button")!);
    await settle();
    expect(model.value).toBe("closed");
    expect(screen.queryByRole("dialog")).toBeNull();
    media.restore();
  });
});

describe("MultiSelectField", () => {
  const tags: readonly SelectOption<string>[] = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta" },
  ];

  it("shows the chosen as chips, removes one, and ticks more in the list", async () => {
    const { model } = mountSelect(MultiSelectField, { label: "Tags", options: tags }, ["a"]);
    expect(screen.getByText("Alpha")).toBeTruthy();
    await fireEvent.click(screen.getByLabelText("Tags"));
    await settle();
    await fireEvent.click(within(screen.getByRole("dialog")).getByRole("option", { name: "Beta" }).querySelector("button")!);
    expect(model.value).toEqual(["a", "b"]);
    await fireEvent.click(screen.getByRole("button", { name: "Clear: Alpha" }));
    expect(model.value).toEqual(["b"]);
  });
});

describe("ComboField", () => {
  const people = (names: string[]): SelectOption<number>[] => names.map((label, index) => ({ value: index + 1, label }));
  const type = async (text: string) => {
    const input = screen.getByRole("combobox");
    await fireEvent.focus(input);
    await fireEvent.update(input, text);
  };

  it("searches after the debounce and lists the answer; Enter on a highlighted option picks it", async () => {
    vi.useFakeTimers();
    const search = vi.fn(async () => people(["Ann", "Anna"]));
    const { model } = mountSelect(ComboField, { label: "Customer", search, debounce: 100 });
    await type("an");
    expect(search).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(120);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0]).toEqual(["an", expect.objectContaining({ signal: expect.any(AbortSignal) })]);
    expect(screen.getAllByRole("option")).toHaveLength(2);
    const input = screen.getByRole("combobox");
    await fireEvent.keyDown(input, { key: "ArrowDown" });
    await fireEvent.keyDown(input, { key: "ArrowDown" });
    await fireEvent.keyDown(input, { key: "Enter" });
    expect(model.value).toBe(2);
    expect((input as HTMLInputElement).value).toBe("Anna");
    expect(screen.queryByRole("listbox")).toBeNull();
    vi.useRealTimers();
  });

  it("only the latest search lands, and the older request is aborted", async () => {
    vi.useFakeTimers();
    const first = deferred<SelectOption<number>[]>();
    const second = deferred<SelectOption<number>[]>();
    const signals: AbortSignal[] = [];
    const search = vi.fn((query: string, { signal }: { signal: AbortSignal }) => {
      signals.push(signal);
      return query === "a" ? first.promise : second.promise;
    });
    mountSelect(ComboField, { label: "Customer", search, debounce: 10 });
    await type("a");
    await vi.advanceTimersByTimeAsync(20);
    await type("ab");
    await vi.advanceTimersByTimeAsync(20);
    expect(signals[0]?.aborted).toBe(true);
    second.resolve(people(["Ab"]));
    await vi.advanceTimersByTimeAsync(0);
    first.resolve(people(["Old answer"]));
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getAllByRole("option").map((option) => option.textContent?.trim())).toEqual(["Ab"]);
    vi.useRealTimers();
  });

  it("shows the label of a saved value from `selected`, and leaving without picking puts it back (ARV cleared the value)", async () => {
    const { model } = mountSelect(ComboField, { label: "Customer", search: async () => [], selected: { value: 7, label: "Saved customer" } }, 7);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    expect(input.value).toBe("Saved customer");
    await fireEvent.focus(input);
    await fireEvent.update(input, "sav");
    await fireEvent.blur(input);
    expect(input.value).toBe("Saved customer");
    expect(model.value).toBe(7);
  });

  it("clearing the text clears the value", async () => {
    const { model } = mountSelect(ComboField, { label: "Customer", options: people(["Ann"]) }, 1);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    expect(input.value).toBe("Ann");
    await fireEvent.focus(input);
    await fireEvent.update(input, "");
    expect(model.value).toBeNull();
  });

  it("filters a fixed list as the user types, with no request", async () => {
    mountSelect(ComboField, { label: "Customer", options: people(["Ann", "Bob", "Anton"]) });
    await type("an");
    expect(screen.getAllByRole("option").map((option) => option.textContent?.trim())).toEqual(["Ann", "Anton"]);
  });

  it("says when the search failed, and Escape closes the list", async () => {
    vi.useFakeTimers();
    const search = vi.fn(async () => {
      throw new ApiError({ kind: "server", message: "x", status: 500 });
    });
    mountSelect(ComboField, { label: "Customer", search, debounce: 10 });
    await type("an");
    await vi.advanceTimersByTimeAsync(20);
    expect(screen.getByRole("alert").textContent).toContain("The search failed");
    await fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    vi.useRealTimers();
  });

  it("does not search for text shorter than the minimum", async () => {
    vi.useFakeTimers();
    const search = vi.fn(async () => []);
    mountSelect(ComboField, { label: "Customer", search, debounce: 10, minLength: 3 });
    await type("ab");
    await vi.advanceTimersByTimeAsync(20);
    expect(search).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
