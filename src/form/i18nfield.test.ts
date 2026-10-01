import { fireEvent, render, screen, within } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, ref } from "vue";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import I18nField from "./I18nField.vue";
import { missingLocales, type I18nText } from "./i18nText";

const i18n = createTestI18n("hr"); // the texts below are the Croatian ones
const global = { plugins: [i18n, testFormatting(i18n)] };

afterEach(() => {
  document.body.innerHTML = "";
});

const locales = ["hr", "bs", "en", "sl"];

function mount(props: Record<string, unknown> = {}, initial: I18nText = {}) {
  const model = ref<I18nText>(initial);
  const Host = defineComponent({ setup: () => () => h("div", [h(I18nField, { label: "Title", locales, ...props, modelValue: model.value, "onUpdate:modelValue": (value: I18nText) => (model.value = value) }), h("button", { id: "elsewhere" }, "elsewhere")]) });
  return { ...render(Host, { global }), model };
}
const tabs = () => within(screen.getByRole("tablist")).getAllByRole("tab");
const dots = () => [...document.querySelectorAll("[data-test='i18n-dot']")].map((dot) => dot.getAttribute("data-state"));
const input = () => document.querySelector("[data-test='i18n-input']") as HTMLInputElement;

describe("missingLocales", () => {
  it("lists the required languages with no text, blank counts as none", () => {
    expect(missingLocales({ hr: "x", en: "  " }, ["hr", "en", "sl"])).toEqual(["en", "sl"]);
    expect(missingLocales(null, ["hr"])).toEqual(["hr"]);
    expect(missingLocales({ hr: "x" }, [])).toEqual([]);
  });
});

describe("I18nField", () => {
  it("has a tab per language with a dot for written, opens in the app's language", () => {
    mount({}, { hr: "Naslov", bs: "Naslov bs" });
    expect(tabs().map((tab) => tab.textContent?.trim())).toEqual(["HR", "BS", "EN", "SL"]);
    expect(dots()).toEqual(["written", "written", "empty", "empty"]);
    expect(tabs()[0]?.getAttribute("aria-selected")).toBe("true");
    expect(tabs()[2]?.getAttribute("aria-label")).toContain("prazno");
    expect(input().value).toBe("Naslov");
    expect(input().getAttribute("lang")).toBe("hr");
  });

  it("edits the open language only and emits the whole record", async () => {
    const { model } = mount({}, { hr: "Naslov" });
    await fireEvent.click(tabs()[2]!);
    expect(input().value).toBe("");
    await fireEvent.update(input(), "Title");
    expect(model.value).toEqual({ hr: "Naslov", en: "Title" });
    expect(dots()).toEqual(["written", "empty", "written", "empty"]);
    await fireEvent.click(tabs()[0]!);
    expect(input().value).toBe("Naslov");
  });

  it("shows the default language first and marks the field required when a language must be written", () => {
    mount({ defaultLocale: "en", requiredLocales: ["en"] }, { en: "x" });
    expect(tabs().map((tab) => tab.textContent?.trim())).toEqual(["EN", "HR", "BS", "SL"]);
    expect(screen.getByText("*")).toBeTruthy();
    expect(document.querySelector("[data-field-required]")?.getAttribute("data-field-filled")).toBe("true");
  });

  it("moves between languages with the arrow keys, only the open one in the tab order", async () => {
    mount({}, { hr: "a", en: "b" });
    await fireEvent.keyDown(tabs()[0]!, { key: "ArrowRight" });
    expect(tabs()[1]?.getAttribute("aria-selected")).toBe("true");
    expect(tabs().map((tab) => tab.getAttribute("tabindex"))).toEqual(["-1", "0", "-1", "-1"]);
    await fireEvent.keyDown(tabs()[1]!, { key: "End" });
    expect(tabs()[3]?.getAttribute("aria-selected")).toBe("true");
  });

  it("reports a required language once the field is left, whichever tab is open, and clears it when written", async () => {
    mount({ requiredLocales: ["hr", "en"] }, { hr: "Naslov" });
    expect(screen.queryByRole("alert")).toBeNull();
    await fireEvent.click(tabs()[1]!); // another tab: still inside the field
    expect(screen.queryByRole("alert")).toBeNull();
    input().focus();
    await fireEvent.focusOut(input(), { relatedTarget: document.getElementById("elsewhere") });
    expect(screen.getByRole("alert").textContent).toContain("Obavezno za");
    expect(dots()).toEqual(["written", "empty", "required", "empty"]);
    await fireEvent.click(tabs()[2]!);
    await fireEvent.update(input(), "Title");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("an error from the form wins over its own", async () => {
    mount({ requiredLocales: ["en"], error: "The server says no." });
    await fireEvent.focusOut(input(), { relatedTarget: document.getElementById("elsewhere") });
    expect(screen.getByRole("alert").textContent).toContain("The server says no.");
  });

  it("copies the default language into the empty ones and leaves written ones alone", async () => {
    const { model } = mount({}, { hr: "Golf 8", en: "Golf eight" });
    expect(document.querySelector("[data-test='i18n-missing']")?.textContent).toContain("bosanski, slovenski");
    await fireEvent.click(document.querySelector("[data-test='i18n-copy']")!);
    expect(model.value).toEqual({ hr: "Golf 8", bs: "Golf 8", en: "Golf eight", sl: "Golf 8" });
    expect(document.querySelector("[data-test='i18n-copy']")).toBeNull();
    expect(document.querySelector("[data-test='i18n-missing']")).toBeNull();
  });

  it("offers no copy while the default language is empty", () => {
    mount({}, { en: "Title" });
    expect(document.querySelector("[data-test='i18n-copy']")).toBeNull();
  });

  it("is a textarea in the multiline variant", () => {
    mount({ multiline: true, rows: 4 }, { hr: "Opis" });
    expect(input().tagName).toBe("TEXTAREA");
    expect(input().getAttribute("rows")).toBe("4");
  });

  it("reads as the current language with the others under a count, and expands", async () => {
    mount({ editable: false }, { hr: "Golf 8", en: "Golf eight" });
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByText("Title · HR")).toBeTruthy();
    expect(screen.getByText("Golf 8")).toBeTruthy();
    const more = screen.getByRole("button", { name: /3 more languages · 1 written|Još jezika: 3 · popunjeno: 1/ });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    await fireEvent.click(more);
    expect(screen.getByText("Golf eight")).toBeTruthy();
    expect(more.getAttribute("aria-expanded")).toBe("true");
  });

  it("reads the default language when the current one is not written", () => {
    mount({ editable: false, defaultLocale: "en" }, { en: "Golf eight" });
    expect(screen.getByText("Title · EN")).toBeTruthy();
  });

  it("takes the app's languages from the translations the app loaded when none are given", () => {
    mount({ locales: undefined });
    expect(tabs().map((tab) => tab.textContent?.trim().toLowerCase()).sort()).toEqual(["bs", "en", "hr", "sl"]);
  });
});
