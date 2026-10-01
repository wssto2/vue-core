import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref, type Component } from "vue";
import { ApiError } from "../client";
import { deferred } from "../platform/testing";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import ComboField from "./ComboField.vue";
import type { SelectOption } from "./options";
import { completionOf, matchParts, recentChoicesKey, type RecentChoices } from "./suggestions";
import TextField from "./TextField.vue";

const i18n = createTestI18n();
const base = { plugins: [i18n, testFormatting(i18n)], stubs: { transition: false } };

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  vi.useRealTimers();
});

/** A field with its model in a ref (so a pick shows), optionally with an app-provided store of recent choices. */
function mountField(component: Component, props: Record<string, unknown>, options: { initial?: unknown; recents?: RecentChoices } = {}) {
  const model = ref<unknown>(options.initial ?? (component === TextField ? "" : null));
  const Host = defineComponent({ setup: () => () => h(component, { ...props, modelValue: model.value, "onUpdate:modelValue": (value: unknown) => (model.value = value) }) });
  const provide = options.recents ? { [recentChoicesKey as symbol]: options.recents } : {};
  return { ...render(Host, { global: { ...base, provide } }), model };
}

const cities = ["Zagreb", "Zagrebačka ulica", "Zadar", "Split"];
/** The label of each row (the detail line is not part of it). */
const names = (): string[] => screen.getAllByRole("option").map((option) => option.querySelector(".text-body")?.textContent?.trim() ?? "");
/** A row by its label: the marked part splits its text, so the accessible name is not one string. */
const row = (label: string): HTMLElement => {
  const found = screen.getAllByRole("option").find((option) => option.querySelector(".text-body")?.textContent?.trim() === label);
  if (!found) throw new Error(`no row "${label}" in ${names().join(", ")}`);
  return found;
};
const type = async (text: string) => {
  const input = screen.getByRole("combobox");
  await fireEvent.focus(input);
  await fireEvent.update(input, text);
};

describe("matching text", () => {
  it("marks the matched part ignoring case and accents, wherever it is", () => {
    expect(matchParts("Zagreb", "zag")).toEqual({ before: "", match: "Zag", after: "reb" });
    expect(matchParts("Čačak", "cac")).toEqual({ before: "", match: "Čač", after: "ak" });
    expect(matchParts("Novi Zagreb", "zag")).toEqual({ before: "Novi ", match: "Zag", after: "reb" });
    expect(matchParts("Split", "x")).toEqual({ before: "", match: "", after: "Split" });
    expect(matchParts("Split", "  ")).toEqual({ before: "", match: "", after: "Split" });
  });

  it("completes only a label that starts with what was typed", () => {
    expect(completionOf("zag", "Zagreb")).toBe("reb");
    expect(completionOf("Zagreb", "Zagreb")).toBe("");
    expect(completionOf("reb", "Zagreb")).toBe("");
    expect(completionOf("", "Zagreb")).toBe("");
  });
});

describe("TextField suggestions", () => {
  it("keeps the value a string, asks after the debounce and below the minimum asks nothing", async () => {
    vi.useFakeTimers();
    const suggestions = vi.fn(async () => ["Zagreb"]);
    const { model } = mountField(TextField, { label: "City", suggestions, suggestionsDebounce: 100, suggestionsMinLength: 2 });
    await type("z");
    await vi.advanceTimersByTimeAsync(150);
    expect(suggestions).not.toHaveBeenCalled();
    expect(model.value).toBe("z");
    await type("za");
    await vi.advanceTimersByTimeAsync(50);
    expect(suggestions).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(80);
    expect(suggestions).toHaveBeenCalledTimes(1);
    expect(suggestions).toHaveBeenCalledWith("za", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(typeof model.value).toBe("string");
  });

  it("only the latest answer lands and the older request is aborted", async () => {
    vi.useFakeTimers();
    const first = deferred<string[]>();
    const second = deferred<string[]>();
    const signals: AbortSignal[] = [];
    const suggestions = vi.fn((query: string, { signal }: { signal: AbortSignal }) => {
      signals.push(signal);
      return query === "za" ? first.promise : second.promise;
    });
    mountField(TextField, { label: "City", suggestions, suggestionsDebounce: 10 });
    await type("za");
    await vi.advanceTimersByTimeAsync(20);
    await type("zag");
    await vi.advanceTimersByTimeAsync(20);
    expect(signals[0]?.aborted).toBe(true);
    second.resolve(["Zagreb"]);
    await vi.advanceTimersByTimeAsync(0);
    first.resolve(["Old answer"]);
    await vi.advanceTimersByTimeAsync(0);
    expect(names()).toEqual(["Zagreb"]);
  });

  it("filters a list as the user types (the best match first) and shows the detail line", async () => {
    mountField(TextField, { label: "City", suggestions: [{ text: "Novi Zagreb", detail: "district" }, "Zagreb", "Split"] });
    await type("zag");
    expect(names()).toEqual(["Zagreb", "Novi Zagreb"]);
    expect(screen.getAllByRole("option")[1]?.textContent).toContain("district");
    expect(row("Novi Zagreb").querySelector("strong")?.textContent).toBe("Zag");
  });

  it("limits the rows", async () => {
    mountField(TextField, { label: "City", suggestions: cities, suggestionsLimit: 2 });
    await type("z");
    expect(names()).toHaveLength(2);
  });

  it("shows the best match grey after the typed text and Tab accepts it", async () => {
    const { model } = mountField(TextField, { label: "City", suggestions: cities });
    await type("zag");
    expect(document.querySelector("[data-test='completion']")?.textContent?.trim()).toBe("zagreb");
    expect(document.querySelector("[data-test='completion'] .text-content-disabled")?.textContent).toBe("reb");
    await fireEvent.keyDown(screen.getByRole("combobox"), { key: "Tab" });
    expect(model.value).toBe("Zagreb");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.querySelector("[data-test='completion']")).toBeNull();
  });

  it("shows no completion for a row that does not start with the text", async () => {
    mountField(TextField, { label: "City", suggestions: [{ text: "Novi Zagreb" }] });
    await type("zag");
    expect(names()).toEqual(["Novi Zagreb"]);
    expect(document.querySelector("[data-test='completion']")).toBeNull();
  });

  it("moves with the arrows, picks a row moved to with Enter, and Escape closes the list", async () => {
    const { model } = mountField(TextField, { label: "City", suggestions: cities });
    await type("za");
    const input = screen.getByRole("combobox");
    await fireEvent.keyDown(input, { key: "ArrowDown" });
    await fireEvent.keyDown(input, { key: "Enter" });
    expect(model.value).toBe("Zagrebačka ulica");
    await type("za");
    await fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not take Enter for a first suggestion nobody moved to (Enter keeps meaning done)", async () => {
    const { model } = mountField(TextField, { label: "City", suggestions: cities });
    await type("zag");
    const event = new KeyboardEvent("keydown", { key: "Enter", cancelable: true, bubbles: true });
    screen.getByRole("combobox").dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(model.value).toBe("zag");
  });

  it("a click picks, and the input keeps focus", async () => {
    const { model } = mountField(TextField, { label: "City", suggestions: cities });
    await type("zad");
    const input = screen.getByRole("combobox");
    input.focus();
    await fireEvent.click(row("Zadar"));
    expect(model.value).toBe("Zadar");
    expect(document.activeElement).toBe(input);
  });

  it("says when the request failed and says nothing when there is no match", async () => {
    vi.useFakeTimers();
    const suggestions = vi.fn(async () => {
      throw new ApiError({ kind: "server", message: "x", status: 500 });
    });
    const failing = mountField(TextField, { label: "City", suggestions, suggestionsDebounce: 10 });
    await type("za");
    await vi.advanceTimersByTimeAsync(20);
    expect(screen.getByRole("alert").textContent).toContain("The search failed");
    failing.unmount();
    mountField(TextField, { label: "City", suggestions: ["Split"] });
    await type("zzz");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("is a combobox with an active descendant, and an ordinary input without suggestions", async () => {
    const { unmount } = mountField(TextField, { label: "City", suggestions: cities });
    await type("za");
    const input = screen.getByRole("combobox");
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(input.getAttribute("aria-controls")).toBe(screen.getByRole("listbox").id);
    expect(document.getElementById(input.getAttribute("aria-activedescendant") ?? "")?.getAttribute("role")).toBe("option");
    unmount();
    mountField(TextField, { label: "City" });
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("does not search for the text already in the field when focus arrives", async () => {
    const suggestions = vi.fn(async () => ["Zagreb"]);
    mountField(TextField, { label: "City", suggestions }, { initial: "Zagreb" });
    await fireEvent.focus(screen.getByRole("combobox"));
    expect(suggestions).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("recent choices", () => {
  const memory = (): RecentChoices & { saved: Record<string, readonly SelectOption<string | number>[]> } => {
    const saved: Record<string, readonly SelectOption<string | number>[]> = {};
    return { saved, read: (id) => saved[id] ?? [], write: (id, choices) => void (saved[id] = choices) };
  };

  it("shows the last picks under Recent before typing, from the app's store, and a pick is remembered once", async () => {
    const recents = memory();
    recents.saved.city = [{ value: "Split", label: "Split" }, { value: "Zadar", label: "Zadar" }];
    const { model } = mountField(TextField, { label: "City", suggestions: cities, recents: "city" }, { recents });
    await fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox").textContent).toContain("Recent");
    expect(names()).toEqual(["Split", "Zadar"]);
    await fireEvent.click(row("Zadar"));
    expect(model.value).toBe("Zadar");
    expect(recents.saved.city?.map((choice) => choice.value)).toEqual(["Zadar", "Split"]);
  });

  it("keeps five at most, newest first", async () => {
    const recents = memory();
    mountField(TextField, { label: "City", suggestions: ["a1", "a2", "a3", "a4", "a5", "a6"], recents: "city" }, { recents });
    for (const name of ["a1", "a2", "a3", "a4", "a5", "a6"]) {
      await type(name);
      await fireEvent.click(screen.getByRole("option", { name }));
    }
    expect(recents.saved.city?.map((choice) => choice.value)).toEqual(["a6", "a5", "a4", "a3", "a2"]);
  });

  it("uses localStorage by default, survives a refusing store, and ignores what is not a choice", async () => {
    localStorage.setItem("vue-core.recent.city", JSON.stringify([{ value: "Rijeka", label: "Rijeka" }, { nonsense: true }, 7]));
    const first = mountField(TextField, { label: "City", suggestions: cities, recents: "city" });
    await fireEvent.focus(screen.getByRole("combobox"));
    expect(names()).toEqual(["Rijeka"]);
    first.unmount();
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    mountField(TextField, { label: "City", suggestions: cities, recents: "city" });
    await type("zad");
    await fireEvent.click(row("Zadar"));
    setItem.mockRestore();
  });

  it("is off without an id", async () => {
    localStorage.setItem("vue-core.recent.city", JSON.stringify([{ value: "Rijeka", label: "Rijeka" }]));
    mountField(TextField, { label: "City", suggestions: cities });
    await fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("ComboField on the same engine", () => {
  const people: SelectOption<number>[] = [{ value: 1, label: "Ann" }, { value: 2, label: "Anna" }, { value: 3, label: "Bob" }];

  it("lists the recent picks before typing and keeps the id type", async () => {
    const recents = { saved: { customer: [{ value: 3, label: "Bob" }] as readonly SelectOption<string | number>[] }, read(id: string) { return (this.saved as Record<string, readonly SelectOption<string | number>[]>)[id] ?? []; }, write() {} };
    const { model } = mountField(ComboField, { label: "Customer", options: people, recents: "customer", search: async () => people }, { recents });
    await fireEvent.focus(screen.getByRole("combobox"));
    expect(names()).toEqual(["Bob"]);
    await fireEvent.click(row("Bob"));
    expect(model.value).toBe(3);
  });

  it("highlights the first row, Enter picks it, and the matched part is marked", async () => {
    const { model } = mountField(ComboField, { label: "Customer", options: people });
    await type("an");
    expect(screen.getAllByRole("option")[0]?.getAttribute("aria-selected")).toBe("true");
    expect(screen.getAllByRole("option")[0]?.querySelector("strong")?.textContent).toBe("An");
    await fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(model.value).toBe(1);
  });
});
