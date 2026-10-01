import { fireEvent, render, screen, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref, type Component } from "vue";
import { ApiError } from "../client";
import { deferred } from "../platform/testing";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import { mockMedia } from "../testing/media";
import MultiSelectField from "./MultiSelectField.vue";
import type { SelectOption } from "./options";
import SelectField from "./SelectField.vue";
import { settle, withSetup } from "./testing";
import { useOptions } from "./useOptions";

const i18n = createTestI18n("en");
const global = { plugins: [i18n, testFormatting(i18n)], stubs: { transition: false } };

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
});

type Answer = { input: string; signal: AbortSignal; answer: ReturnType<typeof deferred<readonly SelectOption<number>[]>> };

/** The two selects of the owner's case: the models load from the make; each ask is a promise the test settles. */
function mountModels(options: { component?: Component; model?: unknown; make?: string | null } = {}) {
  const asks: Answer[] = [];
  const make = ref<string | null>(options.make === undefined ? "audi" : options.make);
  const model = ref<unknown>(options.model ?? (options.component === MultiSelectField ? [] : null));
  const Host = defineComponent({
    setup() {
      const models = useOptions({
        for: () => make.value,
        load: (input: string, { signal }) => {
          const answer = deferred<readonly SelectOption<number>[]>();
          asks.push({ input, signal, answer });
          return answer.promise;
        },
      });
      return () => h(options.component ?? SelectField, { label: "Model", options: models, modelValue: model.value, "onUpdate:modelValue": (value: unknown) => (model.value = value) });
    },
  });
  return { ...render(Host, { global }), asks, make, model };
}

const a3 = { value: 1, label: "A3" };
const a4 = { value: 2, label: "A4" };
const golf = { value: 3, label: "Golf" };
const trigger = () => screen.getAllByLabelText("Model")[0]!;
const dialog = () => screen.getByRole("dialog");

describe("a select with options that load", () => {
  it("keeps the field, its label and its value on screen while loading, with a spinner and aria-busy", async () => {
    const { asks, make, model } = mountModels({ model: 2 });
    asks[0]!.answer.resolve([a3, a4]);
    await settle();
    expect(trigger().textContent).toContain("A4");
    expect(trigger().getAttribute("aria-busy")).toBeNull();

    make.value = "vw";
    await settle();
    expect(trigger().getAttribute("aria-busy")).toBe("true");
    expect(trigger().textContent).toContain("A4"); // the chosen label stays until the new options land
    expect(trigger().querySelector(".animate-spin")).not.toBeNull();
    expect(model.value).toBe(2); // and so does the value: it is not cleared before the answer
    expect(screen.getByText("Model")).toBeTruthy();
  });

  it("opens to a loading row while it waits, then lists what arrives", async () => {
    const { asks } = mountModels();
    await fireEvent.click(trigger());
    await settle();
    expect(within(dialog()).getByText("Loading…")).toBeTruthy();
    expect(within(dialog()).queryAllByRole("option")).toHaveLength(0);
    expect(dialog().querySelector("[aria-busy='true']")).not.toBeNull();

    asks[0]!.answer.resolve([a3, a4]);
    await settle();
    expect(within(dialog()).queryByText("Loading…")).toBeNull();
    expect(within(dialog()).getAllByRole("option").map((option) => option.textContent?.trim())).toEqual(["A3", "A4"]);
    expect(trigger().getAttribute("aria-busy")).toBeNull();
  });

  it("says it failed with a Try again row that asks again", async () => {
    const { asks, model } = mountModels();
    asks[0]!.answer.reject(new ApiError({ kind: "network", status: null, message: "offline" }));
    await settle();
    await fireEvent.click(trigger());
    await settle();
    expect(within(dialog()).getByRole("alert").textContent).toContain("could not be loaded");

    await fireEvent.click(within(dialog()).getByRole("button", { name: "Try again" }));
    await settle();
    expect(asks).toHaveLength(2);
    expect(asks[1]!.input).toBe("audi");
    expect(within(dialog()).getByText("Loading…")).toBeTruthy();

    asks[1]!.answer.resolve([a3]);
    await settle();
    await fireEvent.click(within(dialog()).getByRole("option", { name: "A3" }).querySelector("button")!);
    expect(model.value).toBe(1);
  });

  it("latest input wins: a late answer for an older input is ignored, and its request aborted", async () => {
    const { asks, make } = mountModels();
    expect(asks[0]!.input).toBe("audi");
    make.value = "vw";
    await settle();
    expect(asks[0]!.signal.aborted).toBe(true);
    expect(asks[1]!.signal.aborted).toBe(false);

    asks[1]!.answer.resolve([golf]);
    await settle();
    asks[0]!.answer.resolve([a3, a4]); // the slow first answer arrives last
    await settle();
    await fireEvent.click(trigger());
    await settle();
    expect(within(dialog()).getAllByRole("option").map((option) => option.textContent?.trim())).toEqual(["Golf"]);
  });

  it("a late failure for an older input does not replace the newer answer either", async () => {
    const { asks, make } = mountModels();
    make.value = "vw";
    await settle();
    asks[1]!.answer.resolve([golf]);
    await settle();
    asks[0]!.answer.reject(new Error("late"));
    await settle();
    await fireEvent.click(trigger());
    await settle();
    expect(within(dialog()).queryByRole("alert")).toBeNull();
    expect(within(dialog()).getAllByRole("option")).toHaveLength(1);
  });

  it("clears a value the new options do not contain, and keeps one they do", async () => {
    const { asks, make, model } = mountModels({ model: 2 });
    asks[0]!.answer.resolve([a3, a4]);
    await settle();
    expect(model.value).toBe(2);

    make.value = "audi-ish"; // another input whose answer still has the value
    await settle();
    asks[1]!.answer.resolve([a4, golf]);
    await settle();
    expect(model.value).toBe(2);

    make.value = "vw";
    await settle();
    expect(model.value).toBe(2); // not before the answer lands
    asks[2]!.answer.resolve([golf]);
    await settle();
    expect(model.value).toBeNull();
    expect(trigger().textContent).toContain("Choose…");
  });

  it("clears the value when a first load lands without it (a saved value the list no longer offers)", async () => {
    const { asks, model } = mountModels({ model: 99 });
    expect(model.value).toBe(99);
    asks[0]!.answer.resolve([a3]);
    await settle();
    expect(model.value).toBeNull();
  });

  it("asks nothing while the input it depends on is empty, and empties the list and the value when it becomes empty", async () => {
    const { asks, make, model } = mountModels({ make: null, model: null });
    expect(asks).toHaveLength(0);
    await fireEvent.click(trigger());
    await settle();
    expect(within(dialog()).getByText("No matches")).toBeTruthy();
    await fireEvent.keyDown(document.body, { key: "Escape" });

    make.value = "audi";
    await settle();
    asks[0]!.answer.resolve([a3]);
    await settle();
    model.value = 1;
    await settle();
    make.value = null;
    await settle();
    expect(asks).toHaveLength(1); // nothing asked for no make
    expect(model.value).toBeNull();
  });

  it("does not clear a saved value while the input it depends on is still empty on mount", async () => {
    const { model } = mountModels({ make: null, model: 5 });
    await settle();
    expect(model.value).toBe(5);
  });

  it("opens a bottom sheet on phones with the same rows", async () => {
    const media = mockMedia({ compact: true });
    const { asks } = mountModels();
    await fireEvent.click(trigger());
    await settle();
    expect(within(dialog()).getByText("Loading…")).toBeTruthy();
    asks[0]!.answer.reject(new Error("down"));
    await settle();
    expect(within(dialog()).getByRole("button", { name: "Try again" })).toBeTruthy();
    media.restore();
  });
});

describe("a multiple select with options that load", () => {
  it("shows the spinner, lists what arrives and drops chosen values the new options lack", async () => {
    const { asks, make, model, container } = mountModels({ component: MultiSelectField, model: [1, 2] });
    expect(trigger().getAttribute("aria-busy")).toBe("true");
    asks[0]!.answer.resolve([a3, a4]);
    await settle();
    expect([...container.querySelectorAll("[data-test=chip]")].map((chip) => chip.textContent?.trim())).toEqual(["A3", "A4"]);

    make.value = "vw";
    await settle();
    asks[1]!.answer.resolve([a4, golf]);
    await settle();
    expect(model.value).toEqual([2]);
  });

  it("opens to a loading row and a retry row", async () => {
    const { asks } = mountModels({ component: MultiSelectField });
    await fireEvent.click(trigger());
    await settle();
    expect(within(dialog()).getByText("Loading…")).toBeTruthy();
    asks[0]!.answer.reject(new Error("down"));
    await settle();
    await fireEvent.click(within(dialog()).getByRole("button", { name: "Try again" }));
    await settle();
    expect(asks).toHaveLength(2);
  });
});

describe("useOptions", () => {
  it("without `for` loads once, and reload asks again", async () => {
    const load = vi.fn(async (_context: { signal: AbortSignal }) => [a3]);
    const { result } = withSetup(() => useOptions({ load }));
    expect(result.status).toBe("loading");
    await settle();
    expect(result.status).toBe("loaded");
    expect(result.options).toEqual([a3]);
    result.reload();
    expect(result.status).toBe("loading");
    expect(result.options).toEqual([a3]); // the last answer stays until the next lands
    await settle();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("aborts the request in flight when its scope ends", async () => {
    let signal!: AbortSignal;
    const { unmount } = withSetup(() => useOptions({ load: (context) => ((signal = context.signal), new Promise<never[]>(() => undefined)) }));
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });
});
