import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { createTestI18n } from "../testing/i18n";
import { mockMedia } from "../testing/media";
import { provideSectionIndex, sectionId, type SectionIndex } from "./sectionIndex";
import SectionJumper from "./SectionJumper.vue";
import SectionList from "./SectionList.vue";
import SectionPanel from "./SectionPanel.vue";

const i18n = createTestI18n("en");
const settle = async () => {
  for (let index = 0; index < 4; index++) await new Promise((resolve) => setTimeout(resolve, 0));
};
const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

let media: ReturnType<typeof mockMedia>;
beforeEach(() => {
  media = mockMedia();
  Element.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(document.documentElement, "scrollHeight", { value: 5000, configurable: true });
});
afterEach(() => {
  media.restore();
  document.body.innerHTML = "";
});

/** A long record page: the index, the list, the jumper and three panels. */
function longPage(options: { titles?: string[]; hash?: string } = {}) {
  const captured: { index?: SectionIndex } = {};
  const titles = ref(options.titles ?? ["Identification", "Contact", "Equipment"]);
  const Page = defineComponent({
    setup() {
      captured.index = provideSectionIndex();
      return () =>
        h("div", [
          h(SectionList, { standalone: true }),
          h(SectionJumper),
          ...titles.value.map((title, position) => h(SectionPanel, { title, number: `0${position + 1}`, collapsible: true, presentation: "section" }, () => `${title} content`)),
        ]);
    },
  });
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/", component: Page }, { path: "/other", component: defineComponent({ render: () => h("p", "other") }) }] });
  return router.push(`/${options.hash ?? ""}`).then(() => {
    const view = render(defineComponent({ render: () => h(RouterView) }), { global: { plugins: [router, i18n] }, container: document.body.appendChild(document.createElement("div")) });
    return { ...view, router, titles, index: () => captured.index! };
  });
}

/** Lays the registered sections out at fixed tops, as a browser would. */
const layout = (tops: number[]) =>
  [...document.querySelectorAll<HTMLElement>("[data-presentation]")].forEach((element, position) => {
    element.getBoundingClientRect = () => ({ top: tops[position] ?? 0 }) as DOMRect;
  });

describe("sectionId", () => {
  it("makes an anchor of a title, with diacritics folded", () => {
    expect(sectionId("Podaci o vozilu")).toBe("podaci-o-vozilu");
    expect(sectionId("Đurđevac · Šibenik")).toBe("durdevac-sibenik");
    expect(sectionId("  ")).toBe("");
  });
});

describe("SectionPanel and SectionList", () => {
  it("lists the panels in document order, each linking to its anchor, and registers the number", async () => {
    await longPage();
    const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-test="section-list"] a')];
    expect(links.map((link) => [...link.querySelectorAll("span")].map((part) => part.textContent))).toEqual([["01", "Identification"], ["02", "Contact"], ["03", "Equipment"]]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["#identification", "#contact", "#equipment"]);
    expect(document.getElementById("contact")?.textContent).toContain("Contact content");
    expect(screen.getByRole("navigation", { name: "Sections" })).toBeTruthy();
  });

  it("lists nothing for a single section: there is nothing to jump between", async () => {
    await longPage({ titles: ["Only"] });
    expect(document.querySelector('[data-test="section-list"]')).toBeNull();
  });

  it("marks the section in view as the scroll spy sees it", async () => {
    await longPage();
    layout([-400, 80, 700]);
    window.dispatchEvent(new Event("scroll"));
    await frame();
    await nextTick();
    const current = document.querySelector('[data-test="section-list"] [aria-current="location"]');
    expect(current?.textContent).toContain("Contact");
  });

  it("scrolls to a section on choosing it, expands it when it was collapsed, moves focus there and writes the fragment without a history entry", async () => {
    const page = await longPage();
    const equipment = document.getElementById("equipment")!;
    // collapse it: the body is hidden
    await fireEvent.click(equipment.querySelector("button")!);
    expect(equipment.querySelector<HTMLElement>("[id^=panel-body]")?.style.display).toBe("none");

    await fireEvent.click(screen.getByText("Equipment", { selector: "[data-test^=section-link] span" }));
    await settle();
    expect(equipment.querySelector<HTMLElement>("[id^=panel-body]")?.style.display).not.toBe("none");
    expect(equipment.scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: "start" }));
    expect(document.activeElement).toBe(equipment);
    expect(page.router.currentRoute.value.hash).toBe("#equipment");
    expect(page.index().activeId.value).toBe("equipment");
  });

  it("scrolls to the section a page was opened with in its fragment, without rewriting the URL", async () => {
    const page = await longPage({ hash: "#contact" });
    await frame();
    await settle();
    expect(document.getElementById("contact")!.scrollIntoView).toHaveBeenCalled();
    expect(page.router.currentRoute.value.hash).toBe("#contact");
  });

  it("keeps the list in step with titles that change, and with panels that come and go", async () => {
    const page = await longPage();
    page.titles.value = ["Identification", "Contact details", "Equipment", "Notes"];
    await settle();
    const labels = [...document.querySelectorAll('[data-test="section-list"] a')].map((link) => link.textContent);
    expect(labels.length).toBe(4);
    expect(labels[1]).toContain("Contact");
    page.titles.value = ["Identification"];
    await settle();
    expect(document.querySelector('[data-test="section-list"]')).toBeNull();
    expect(page.index().sections.value.map((section) => section.id)).toEqual(["identification"]);
  });

  it("rejects two sections with one id", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const Page = defineComponent({
      setup() {
        provideSectionIndex();
        return () => [h(SectionPanel, { title: "Same" }), h(SectionPanel, { title: "Same" })];
      },
    });
    await expect(async () => {
      render(Page, { global: { plugins: [i18n] } });
      await nextTick();
    }).rejects.toThrow(/registered twice/);
    warn.mockRestore();
  });

  it("is the plain panel outside a section index", () => {
    render(SectionPanel, { props: { title: "Alone" }, slots: { default: "body" }, global: { plugins: [i18n] } });
    expect(screen.getByText("body")).toBeTruthy();
    expect(screen.getByText("Alone")).toBeTruthy();
  });

  it("stops listening to the window once the page is gone", async () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const page = await longPage();
    expect(add.mock.calls.some(([type]) => type === "scroll")).toBe(true);
    page.unmount();
    expect(remove.mock.calls.some(([type]) => type === "scroll")).toBe(true);
  });
});

describe("SectionJumper", () => {
  it("shows the section in view and lists the sections in a menu; choosing one scrolls there", async () => {
    await longPage();
    layout([-400, 80, 700]);
    window.dispatchEvent(new Event("scroll"));
    await frame();
    await nextTick();
    const trigger = screen.getByRole("button", { name: /Sections: 02 Contact/ });
    await fireEvent.click(trigger);
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent?.trim());
    expect(items).toEqual(["01 Identification", "02 Contact", "03 Equipment"]);
    await fireEvent.click(screen.getAllByRole("menuitem")[2]!);
    await settle();
    expect(document.getElementById("equipment")!.scrollIntoView).toHaveBeenCalled();
  });
});
