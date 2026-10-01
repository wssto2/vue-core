import { fireEvent, render, screen, waitFor, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import { phoneDefaultsKey, type PhoneDefaults } from "./environment";
import PhoneField from "./PhoneField.vue";

const i18n = createTestI18n();

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount(props: Record<string, unknown> = {}, initial = "", defaults: PhoneDefaults = {}, slots: Record<string, () => unknown> = {}) {
  const model = ref(initial);
  const updates: string[] = [];
  const Host = defineComponent({
    setup: () => () => h("div", [h(PhoneField, { label: "Mobile", ...props, modelValue: model.value, "onUpdate:modelValue": (value: string) => { updates.push(value); model.value = value; } }, slots), h("button", { id: "elsewhere" }, "elsewhere")]),
  });
  return { ...render(Host, { global: { plugins: [i18n, testFormatting(i18n)], provide: { [phoneDefaultsKey as symbol]: defaults } } }), model, updates };
}
const input = () => document.querySelector("[data-test='phone-input']") as HTMLInputElement;
const country = () => document.querySelector("[data-test='country-button']") as HTMLButtonElement;
const type = async (text: string) => {
  const field = input();
  field.focus();
  await fireEvent.update(field, text);
};
const leave = () => fireEvent.blur(input());

describe("typing", () => {
  it("stores E.164 and formats the number as it is typed, for HR, BA, SI and RS", async () => {
    for (const [defaultCountry, typed, e164, shown, dial] of [
      ["HR", "0912345678", "+385912345678", "91 234 5678", "+385"],
      ["BA", "061 234 567", "+38761234567", "61 234 567", "+387"],
      ["SI", "041123456", "+38641123456", "41 123 456", "+386"],
      ["RS", "0601234567", "+381601234567", "60 1234567", "+381"],
    ] as const) {
      const { model, unmount } = mount({ defaultCountry });
      await type(typed);
      expect(model.value).toBe(e164);
      expect((input() as HTMLInputElement).value).toBe(shown);
      expect(country().textContent).toContain(dial);
      unmount();
    }
  });

  it("starts in Croatia, or in the app's default, and a prop wins", () => {
    mount();
    expect(country().textContent).toContain("+385");
    document.body.innerHTML = "";
    mount({}, "", { defaultCountry: "SI" });
    expect(country().textContent).toContain("+386");
    document.body.innerHTML = "";
    mount({ defaultCountry: "RS" }, "", { defaultCountry: "SI" });
    expect(country().textContent).toContain("+381");
  });

  it("deleting a space takes the digit beside it instead of putting the space back", async () => {
    const { model } = mount();
    await type("91 234 5678");
    const field = input();
    field.value = "91234 5678"; // the space after "91" was deleted with Backspace
    field.setSelectionRange(2, 2);
    await fireEvent.input(field, { inputType: "deleteContentBackward" });
    expect(model.value).toBe("+38592345678");
    expect(field.value).toBe("92 345 678");
  });

  it("empties to an empty string", async () => {
    const { model } = mount({}, "+385912345678");
    await type("");
    expect(model.value).toBe("");
  });

  it("a pasted international number switches the country", async () => {
    const { model } = mount();
    input().focus();
    await fireEvent.paste(input(), { clipboardData: { getData: () => " +387 61 234 567 " } });
    expect(model.value).toBe("+38761234567");
    expect((input() as HTMLInputElement).value).toBe("61 234 567");
    expect(country().textContent).toContain("+387");
    expect(country().getAttribute("aria-label")).toContain("Bosnia");
  });

  it("typing a plus switches the country once the dial code is complete, and a national paste is an ordinary input", async () => {
    const { model } = mount();
    await type("+3");
    expect(model.value).toBe("");
    expect((input() as HTMLInputElement).value).toBe("+3");
    await type("+38661123456");
    expect(country().textContent).toContain("+386");
    expect(model.value).toBe("+38661123456");
    const event = new Event("paste", { cancelable: true, bubbles: true }) as ClipboardEvent;
    Object.defineProperty(event, "clipboardData", { value: { getData: () => "091 234 5678" } });
    input().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("a stored value", () => {
  it("shows its country and number without saying anything back", () => {
    const { updates } = mount({}, "+38761234567");
    expect(country().textContent).toContain("+387");
    expect((input() as HTMLInputElement).value).toBe("61 234 567");
    expect(updates).toEqual([]);
  });

  it("reads a legacy national number as the default country's, and follows an outside change", async () => {
    const { model, updates } = mount({ defaultCountry: "HR" }, "091 234 5678");
    expect((input() as HTMLInputElement).value).toBe("91 234 5678");
    expect(country().textContent).toContain("+385");
    expect(updates).toEqual([]);
    model.value = "+38641123456";
    await waitFor(() => expect((input() as HTMLInputElement).value).toBe("41 123 456"));
    expect(country().textContent).toContain("+386");
  });
});

describe("what is wrong, and what it is", () => {
  it("names the country in the message once the field is left", async () => {
    mount({ defaultCountry: "BA" });
    await type("33 44 5");
    expect(screen.queryByRole("alert")).toBeNull();
    await leave();
    expect(screen.getByRole("alert").textContent).toContain("too short for Bosnia");
    expect(input().getAttribute("aria-invalid")).toBe("true");
    await type("33 445 566");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says too long and not valid", async () => {
    mount({ defaultCountry: "BA" });
    await type("33 445 566 77");
    await leave();
    expect(screen.getByRole("alert").textContent).toContain("too long for Bosnia");
    await type("60 123 456");
    expect(screen.getByRole("alert").textContent).toContain("not a valid number for Bosnia");
  });

  it("the form's own error wins, and an empty field says nothing", async () => {
    mount({ error: "Enter a number." });
    await leave();
    expect(screen.getByRole("alert").textContent).toContain("Enter a number.");
    document.body.innerHTML = "";
    mount();
    await leave();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("notes mobile or landline when it can tell", async () => {
    mount({ defaultCountry: "BA" });
    await type("61 234 567");
    expect(document.querySelector("[data-test='phone-kind']")?.textContent).toContain("Mobile number");
    await type("33 445 566");
    expect(document.querySelector("[data-test='phone-kind']")?.textContent).toContain("Landline number");
    await type("33 44");
    expect(document.querySelector("[data-test='phone-kind']")).toBeNull();
  });
});

describe("the country picker", () => {
  it("lists the common countries first, then all; searches by name and by dial code; picking keeps the digits", async () => {
    const { model } = mount({}, "+385912345678");
    await fireEvent.click(country());
    const list = screen.getByRole("listbox", { name: "Countries" });
    const codes = () => within(list).getAllByRole("option").map((option) => option.getAttribute("data-country"));
    expect(codes().slice(0, 4)).toEqual(["HR", "BA", "SI", "RS"]);
    expect(codes().length).toBeGreaterThan(200);
    expect(list.textContent).toContain("Common");
    expect(list.textContent).toContain("All countries");
    const search = screen.getByRole("combobox", { name: /Type a country/ });
    await fireEvent.update(search, "+387");
    expect(codes()).toEqual(["BA"]);
    await fireEvent.update(search, "slov");
    expect(codes()).toEqual(["SI", "SK"]);
    await fireEvent.update(search, "zzz");
    expect(screen.getByRole("status").textContent).toContain("No country matches");
    await fireEvent.update(search, "387");
    await fireEvent.keyDown(search, { key: "Enter" });
    expect(model.value).toBe("+387912345678");
    expect(country().textContent).toContain("+387");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("moves with the arrows, closes with Escape and hands focus back", async () => {
    const { model } = mount({}, "+385912345678");
    await fireEvent.click(country());
    const search = screen.getByRole("combobox", { name: /Type a country/ });
    await fireEvent.keyDown(search, { key: "ArrowDown" });
    await fireEvent.keyDown(search, { key: "Enter" });
    expect(country().textContent).toContain("+387");
    expect(model.value).toBe("+387912345678");
    await fireEvent.click(country());
    await fireEvent.keyDown(screen.getByRole("combobox", { name: /Type a country/ }), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(country());
  });

  it("shows SVG flags, not emoji", async () => {
    // a flag loads when it scrolls into view: here it always has
    vi.stubGlobal("IntersectionObserver", class { constructor(private readonly callback: (entries: { isIntersecting: boolean }[]) => void) {} observe() { this.callback([{ isIntersecting: true }]); } disconnect() {} });
    mount({}, "+385912345678");
    await waitFor(() => expect(document.querySelector("[data-test='country-button'] img")?.getAttribute("src")).toMatch(/^data:image\/svg\+xml,/));
    expect(country().textContent).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]/u);
  });

  it("takes the common countries from the prop", async () => {
    mount({ commonCountries: ["DE", "AT"] });
    await fireEvent.click(country());
    expect(within(screen.getByRole("listbox")).getAllByRole("option").slice(0, 2).map((option) => option.getAttribute("data-country"))).toEqual(["DE", "AT"]);
  });

  it("a locked field cannot open it", async () => {
    mount({ disabled: true });
    expect(country().disabled).toBe(true);
  });
});

describe("reading", () => {
  it("shows the international number with Call, Message and Copy", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    mount({ editable: false }, "+385912345678");
    expect(document.querySelector("[data-test='phone-read']")?.textContent).toContain("+385 91 234 5678");
    expect(screen.getByRole("link", { name: "Call" }).getAttribute("href")).toBe("tel:+385912345678");
    expect(screen.getByRole("link", { name: "Message" }).getAttribute("href")).toBe("sms:+385912345678");
    await fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("+385 91 234 5678");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Copied"));
  });

  it("claims nothing when the clipboard refuses", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => Promise.reject(new Error("denied")) }, configurable: true });
    mount({ editable: false }, "+385912345678");
    await fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("lets the app add an action of its own (WhatsApp) and shows nothing for an empty number", () => {
    mount({ editable: false }, "+385912345678", {}, { actions: () => h("a", { href: "https://wa.me/385912345678" }, "WhatsApp") });
    expect(screen.getByRole("link", { name: "WhatsApp" })).toBeTruthy();
    document.body.innerHTML = "";
    mount({ editable: false }, "");
    expect(screen.queryByRole("link")).toBeNull();
  });
});
