import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, ref, type Component } from "vue";
import { createTestI18n } from "../testing/i18n";
import TabbedSheet, { type SheetTab } from "./TabbedSheet.vue";

const global = { plugins: [createTestI18n()], stubs: { transition: false as boolean | Component } };
type Handle = { present: () => void };

function mount(tabs: SheetTab<string>[]) {
  const tab = ref("general");
  const sheet = ref<Handle | null>(null);
  const Host = defineComponent({
    setup: () => () =>
      h(TabbedSheet<string>, { ref: sheet, tabs, tab: tab.value, "onUpdate:tab": (next: string) => (tab.value = next), title: "Page settings" }, {
        default: ({ tab: current }: { tab: string }) => h("p", { "data-field": current }, `fields of ${current}`),
        footer: () => h("button", "Save"),
      }),
  });
  const view = render(Host, { global });
  sheet.value!.present();
  return { ...view, tab };
}
const settle = async () => { await nextTick(); await nextTick(); };

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
});

describe("TabbedSheet", () => {
  it("shows tabs over one body and one footer", async () => {
    mount([{ value: "general", label: "General" }, { value: "seo", label: "SEO" }]);
    await settle();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent!.trim())).toEqual(["General", "SEO"]);
    expect(screen.getAllByRole("button", { name: "Save" })).toHaveLength(1);
  });

  it("keeps every tab's content mounted and shows the selected one", async () => {
    const { tab } = mount([{ value: "general", label: "General" }, { value: "seo", label: "SEO" }]);
    await settle();
    const panel = (key: string) => document.querySelector<HTMLElement>(`[data-tab-panel=${key}]`)!;
    expect(panel("general").style.display).not.toBe("none");
    expect(panel("seo").style.display).toBe("none");
    expect(panel("seo").textContent).toBe("fields of seo");
    await fireEvent.click(screen.getByRole("tab", { name: "SEO" }));
    expect(tab.value).toBe("seo");
    await nextTick();
    expect(panel("seo").style.display).not.toBe("none");
    expect(panel("general").style.display).toBe("none");
  });

  it("marks a tab that has errors, with a name for screen readers", async () => {
    mount([{ value: "general", label: "General" }, { value: "seo", label: "SEO", error: true }, { value: "more", label: "More", error: "2 fields are wrong" }]);
    await settle();
    const marked = (name: string) => screen.getByRole("tab", { name: new RegExp(name) }).querySelector("[role=img]");
    expect(marked("General")).toBeNull();
    expect(marked("SEO")!.getAttribute("aria-label")).toBe("Has errors");
    expect(marked("More")!.getAttribute("aria-label")).toBe("2 fields are wrong");
  });
});
