import { render } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { ApiError } from "../client";
import { settle } from "../testing";
import { createTestI18n } from "../testing/i18n";
import FormErrors from "./FormErrors.vue";
import TextField from "./TextField.vue";
import { useForm } from "./useForm";
import { useHiddenFieldErrors } from "./useHiddenFieldErrors";

const i18n = createTestI18n();
afterEach(() => (document.body.innerHTML = ""));

describe("useHiddenFieldErrors", () => {
  it("returns the errors whose field is not on screen: exactly the ones FormErrors lists", async () => {
    let hidden!: ReturnType<typeof useHiddenFieldErrors>;
    let form!: ReturnType<typeof useForm<{ name: string; oib: string }>>;
    const Host = defineComponent({
      setup() {
        form = useForm({ defaults: () => ({ name: "", oib: "" }) });
        hidden = useHiddenFieldErrors({ form });
        return () => h("div", [h(TextField, { ...form.bind("name"), label: "Name" }), h(FormErrors, { form })]);
      },
    });
    render(Host, { global: { plugins: [i18n] } });
    await settle();
    expect(hidden.value).toEqual([]);

    // As an app uses it: the refused submit sets the errors, and the answer is there one tick after the submit resolves.
    await form.submit(async () => {
      throw new ApiError({ kind: "validation", message: "no", status: 422, fields: { name: ["Too short"], oib: ["Invalid OIB"] } });
    });
    await nextTick();
    expect(hidden.value).toEqual([{ field: "oib", message: "Invalid OIB" }]);
    const listed = [...document.querySelectorAll("[data-test=form-errors-hidden] li")].map((li) => li.textContent);
    expect(listed).toEqual(["oib: Invalid OIB"]);
  });
});
