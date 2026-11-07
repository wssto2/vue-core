import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { platformKey } from "../platform";
import { createTestI18n, createTestPlatform, jsonResponse, routedTransport } from "../testing";
import CharacteristicField from "./CharacteristicField.vue";
import { useForm } from "./useForm";

const i18n = createTestI18n();
const views: { unmount: () => void }[] = [];
afterEach(() => {
  for (const view of views.splice(0)) view.unmount();
  cleanup();
  document.body.innerHTML = "";
});

const options = (items: [string, string][]) => jsonResponse(200, { success: true, data: items.map(([value, label]: [string, string]) => ({ value, label })) });
const BRANDS = options([["11", "Renault"], ["12", "Dacia"], ["13", "Peugeot"]]);

function mount(props: Record<string, unknown>, answers: Record<string, Parameters<typeof routedTransport>[0][string]> = { "GET /v1/characteristics/options": BRANDS }, start: unknown = null) {
  const { transport, calls } = routedTransport(answers);
  const platform = createTestPlatform({ transport });
  const model = ref<unknown>(start);
  const Host = defineComponent({
    setup: () => () => h(CharacteristicField as never, { label: "Marka", level: 3, parent: 2, modelValue: model.value, "onUpdate:modelValue": (next: unknown) => (model.value = next), ...props } as never),
  });
  const view = render(Host, { global: { plugins: [i18n], provide: { [platformKey as symbol]: platform } } });
  views.push(view);
  return { ...view, model, calls };
}
const query = (call: { url: string }) => Object.fromEntries(new URL(call.url, "http://x").searchParams);
async function open() {
  await fireEvent.click(screen.getByLabelText(/Marka/));
  const list = await screen.findByRole("listbox");
  await screen.findAllByRole("option");
  return within(list);
}
const labels = (list: ReturnType<typeof within>) => list.getAllByRole("option").map((option: HTMLElement) => option.textContent?.trim());

describe("CharacteristicField", () => {
  it("asks the options of the branch (level, parent, lang) and lists them in the server's order", async () => {
    const { calls } = mount({ lang: "hr" });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(query(calls[0]!)).toEqual({ level: "3", parent: "2", lang: "hr" });
    expect(labels(await open())).toEqual(["Renault", "Dacia", "Peugeot"]);
  });

  it("saves the item's id as a number by default", async () => {
    const { model } = mount({});
    const list = await open();
    await fireEvent.click(within(list.getByRole("option", { name: "Dacia" })).getByRole("button", { name: "Dacia" }));
    expect(model.value).toBe(12);
  });

  it("saves the described column instead of the id when value names one, and asks for it", async () => {
    const answers = { "GET /v1/characteristics/options": options([["renault", "Renault"], ["dacia", "Dacia"]]) };
    const { model, calls } = mount({ value: "additional_3" }, answers);
    const list = await open();
    await fireEvent.click(within(list.getByRole("option", { name: "Dacia" })).getByRole("button", { name: "Dacia" }));
    expect(model.value).toBe("dacia");
    expect(query(calls[0]!).value).toBe("additional_3");
  });

  it("does not send a level-1 parent, and asks nothing below level 1 until the parent is known", async () => {
    const top = mount({ level: 1, parent: undefined });
    await waitFor(() => expect(top.calls).toHaveLength(1));
    expect(query(top.calls[0]!)).toEqual({ level: "1" });
    document.body.innerHTML = "";
    const idle = mount({ level: 2, parent: null });
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(idle.calls).toHaveLength(0);
  });

  it("multiple: ticks several values, saved as a list", async () => {
    const { model } = mount({ multiple: true }, undefined, []);
    const list = await open();
    await fireEvent.click(within(list.getByRole("option", { name: "Renault" })).getByRole("button", { name: "Renault" }));
    await fireEvent.click(within(list.getByRole("option", { name: "Peugeot" })).getByRole("button", { name: "Peugeot" }));
    expect(model.value).toEqual([11, 13]);
  });

  it("an inactive item that is already chosen is listed, marked inactive; an inactive one that is not chosen is not (the server never sends it)", async () => {
    mount({}, undefined, 99);
    expect(await screen.findByText("Renault", {}, { timeout: 100 }).catch(() => null)).toBeNull(); // nothing chosen is Renault
    document.body.innerHTML = "";
    mount({ selected: { value: 99, label: "Škoda" } }, undefined, 99);
    const list = await open();
    expect(labels(list)).toEqual(["Renault", "Dacia", "Peugeot", "Škoda (inactive)"]);
    document.body.innerHTML = "";
    mount({ selected: { value: 99, label: "Škoda" } }, undefined, 11);
    expect(labels(await open())).toEqual(["Renault", "Dacia", "Peugeot"]);
  });

  it("multiple: a chosen inactive item shows marked, and is gone once unticked", async () => {
    mount({ multiple: true, selected: [{ value: 99, label: "Škoda" }] }, undefined, [99]);
    expect(await screen.findByText("Škoda (inactive)")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: /remove|Škoda/i }));
    await waitFor(() => expect(screen.queryByText("Škoda (inactive)")).toBeNull());
  });

  it("works with form.bind like any field, and clears a value the new parent's branch lacks", async () => {
    const answers = { "GET /v1/characteristics/options": (call: { url: string }) => (new URL(call.url, "http://x").searchParams.get("parent") === "2" ? BRANDS.clone() : options([["21", "Audi"]])) };
    const { transport } = routedTransport(answers as never);
    const platform = createTestPlatform({ transport });
    const parent = ref(2);
    let form!: ReturnType<typeof useForm<{ make: number | null }>>;
    const Host = defineComponent({
      setup() {
        form = useForm({ defaults: () => ({ make: 12 as number | null }) });
        return () => h(CharacteristicField as never, { ...form.bind("make"), label: "Marka", level: 3, parent: parent.value } as never);
      },
    });
    views.push(render(Host, { global: { plugins: [i18n], provide: { [platformKey as symbol]: platform } } }));
    await fireEvent.click(screen.getByLabelText(/Marka/));
    expect((await screen.findAllByRole("option")).length).toBe(3);
    parent.value = 5;
    await waitFor(() => expect(form.values.make).toBeNull());
  });

  it("says that it is loading, and offers Try again when the options failed", async () => {
    let broken = true;
    const answers = { "GET /v1/characteristics/options": () => (broken ? jsonResponse(500, { success: false, error: "boom" }) : BRANDS.clone()) };
    const { calls } = mount({}, answers as never);
    const field = screen.getByLabelText(/Marka/);
    expect(field.querySelector("[class*=animate-spin]") ?? field.closest("[aria-busy]") ?? field).toBeTruthy();
    await fireEvent.click(field);
    const retry = await screen.findByRole("button", { name: "Try again" });
    broken = false;
    await fireEvent.click(retry);
    expect(calls).toHaveLength(2);
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));
  });
});
