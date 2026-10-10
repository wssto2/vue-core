import { render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import FormGroup from "./FormGroup.vue";
import FormView from "./FormView.vue";
import TextField from "./TextField.vue";

const i18n = createTestI18n();
const global = { plugins: [i18n, testFormatting(i18n)] };
afterEach(() => void (document.body.innerHTML = ""));

const flag = () => h("img", { src: "/flags/ba.png", alt: "", "data-testid": "flag" });
const field = (props: Record<string, unknown>) => h(TextField, { label: "Bosnia", modelValue: "Verzija", ...props }, { prefix: flag });
const alone = (props: Record<string, unknown> = {}) => render(defineComponent({ setup: () => () => field(props) }), { global });
const grouped = (editable: boolean, props: Record<string, unknown> = {}) =>
  render(defineComponent({ setup: () => () => h(FormView, { editable } as never, () => h(FormGroup, {}, () => field(props))) }), { global });

describe("#prefix on TextField", () => {
  it("draws the icon inside the control, before the value, on a field of its own and in a row", () => {
    for (const mount of [() => alone(), () => grouped(true)]) {
      const view = mount();
      const input = view.container.querySelector("input")!;
      const prefix = view.container.querySelector('[data-test="field-prefix"]')!;
      expect(prefix.contains(screen.getByTestId("flag"))).toBe(true);
      expect(prefix.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // before the input
      expect(prefix.parentElement!.contains(input)).toBe(true); // in the control's own surface
      view.unmount();
    }
  });

  it("is in front of the value when the field reads, in a row and on its own", () => {
    for (const mount of [() => alone({ editable: false }), () => grouped(false)]) {
      const view = mount();
      const prefix = view.container.querySelector('[data-test="field-prefix"]')!;
      expect(view.container.querySelector("input")).toBeNull();
      expect(prefix.contains(screen.getByTestId("flag"))).toBe(true);
      expect(prefix.parentElement!.textContent?.trim()).toBe("Verzija"); // the flag, then the value in the same line
      view.unmount();
    }
  });

  it("is not drawn before 'not entered' when reading an empty value, and a field without the slot draws nothing extra", () => {
    const empty = grouped(false, { modelValue: "" });
    expect(empty.container.querySelector('[data-test="field-prefix"]')).toBeNull();
    empty.unmount();
    const plain = render(defineComponent({ setup: () => () => h(TextField, { label: "Plain", modelValue: "x" }) }), { global });
    expect(plain.container.querySelector('[data-test="field-prefix"]')).toBeNull();
  });
});
