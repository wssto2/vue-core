import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCommentVNode, defineComponent, h, nextTick, ref } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { mockMedia } from "../testing/media";
import DateButton from "./DateButton.vue";
import IconTile from "./IconTile.vue";
import PopupButton from "./PopupButton.vue";
import SearchInput from "./SearchInput.vue";
import SwipeActions from "./SwipeActions.vue";
import Tabs, { type TabItem } from "./Tabs.vue";

describe("IconTile", () => {
  it("uses the tile role of its tone and hides from assistive tech", () => {
    const { container } = render(IconTile, { props: { tone: "brand", icon: "save" } });
    const root = container.firstElementChild!;

    expect(root.className).toContain("bg-tile-brand");
    expect(root.className).toContain("text-tile-brand-foreground");
    expect(root.className).toContain("size-tile");
    expect(root.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders letters when there is no icon", () => {
    const { container } = render(IconTile, { props: { tone: "anchor", text: "TV", size: "md" } });

    expect(container.textContent).toBe("TV");
    expect(container.firstElementChild!.className).toContain("bg-tile-anchor");
  });
});

describe("PopupButton", () => {
  it("shows the value, reports its popup state and emits click", async () => {
    const onClick = vi.fn();
    render(PopupButton, { props: { expanded: true, onClick }, slots: { default: "G." } });
    const button = screen.getByRole("button", { name: /G\./ });

    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-haspopup")).toBe("listbox");
    await fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows the placeholder muted when empty, and the plain style has no fill", () => {
    const { container } = render(PopupButton, { props: { variant: "plain", placeholder: "Choose" } });
    const button = container.querySelector("button")!;

    expect(button.textContent).toContain("Choose");
    expect(button.querySelector(".text-content-disabled")).not.toBeNull();
    expect(button.className).not.toContain("bg-fill");
  });

  it("marks itself invalid", () => {
    render(PopupButton, { props: { invalid: true }, slots: { default: "x" } });
    expect(screen.getByRole("button").getAttribute("aria-invalid")).toBe("true");
  });
});

describe("DateButton", () => {
  it("is quiet at rest and tinted while its picker is open", async () => {
    const { rerender } = render(DateButton, { props: { expanded: false }, slots: { default: "14. 3. 1984." } });
    expect(screen.getByRole("button").className).toContain("bg-fill");

    await rerender({ expanded: true });
    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-tint-soft");
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("shows the placeholder when the owner's slot renders nothing (a v-if template)", () => {
    const Owner = defineComponent({
      setup: () => () => h(DateButton, { placeholder: "Choose..." }, { default: () => [createCommentVNode("v-if", true)] }),
    });
    render(Owner);

    expect(screen.getByRole("button").textContent).toBe("Choose...");
  });

  it("is disabled when told so", () => {
    render(DateButton, { props: { disabled: true, placeholder: "—" } });
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
  });
});

describe("SearchInput", () => {
  it("is a search field named by its label, bound with v-model", async () => {
    const Owner = defineComponent({
      components: { SearchInput },
      setup: () => ({ query: ref("") }),
      template: `<div><SearchInput v-model="query" label="Search everything" placeholder="Type…" /><output>{{ query }}</output></div>`,
    });
    render(Owner);

    const input = screen.getByRole("searchbox", { name: "Search everything" });
    await fireEvent.update(input, "clio");
    expect(screen.getByRole("status").textContent).toBe("clio");
  });
});

describe("Tabs", () => {
  const tabs: TabItem<string>[] = [
    { value: "notes", label: "Notes", badge: 3 },
    { value: "history", label: "Change history", shortLabel: "History" },
    { value: "files", label: "Files", warning: "Missing documents" },
  ];

  function mountTabs(props: Record<string, unknown> = {}) {
    const Owner = defineComponent({
      components: { Tabs },
      setup: () => ({ tabs, current: ref("notes"), props }),
      template: `<Tabs v-model="current" :tabs="tabs" label="Sections" v-bind="props"><p>panel for {{ current }}</p></Tabs>`,
    });
    return render(Owner);
  }

  it("is a tablist: one selected tab, the others out of the tab order, a labelled panel", () => {
    mountTabs();

    const list = screen.getByRole("tablist", { name: "Sections" });
    expect(list).toBeTruthy();
    const [notes, history] = screen.getAllByRole("tab");
    expect(notes!.getAttribute("aria-selected")).toBe("true");
    expect(notes!.getAttribute("tabindex")).toBe("0");
    expect(history!.getAttribute("tabindex")).toBe("-1");
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(notes!.id);
    expect(screen.getByRole("tabpanel").textContent).toBe("panel for notes");
  });

  it("selects on click and shows the badge", async () => {
    mountTabs();
    await fireEvent.click(screen.getByRole("tab", { name: /Change history/ }));

    expect(screen.getByRole("tabpanel").textContent).toBe("panel for history");
    expect(screen.getByRole("tab", { name: /Notes/ }).textContent).toContain("3");
  });

  it("moves with the arrow keys, Home and End, wrapping around, and focuses the new tab", async () => {
    mountTabs();
    const [notes, history, files] = screen.getAllByRole("tab");
    notes!.focus();

    await fireEvent.keyDown(notes!, { key: "ArrowRight" });
    expect(history!.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(history);

    await fireEvent.keyDown(history!, { key: "End" });
    expect(files!.getAttribute("aria-selected")).toBe("true");
    await fireEvent.keyDown(files!, { key: "ArrowRight" });
    expect(notes!.getAttribute("aria-selected")).toBe("true");
    await fireEvent.keyDown(notes!, { key: "ArrowLeft" });
    expect(files!.getAttribute("aria-selected")).toBe("true");
    await fireEvent.keyDown(files!, { key: "Home" });
    expect(notes!.getAttribute("aria-selected")).toBe("true");
  });

  it("names a tab's warning for assistive tech", () => {
    mountTabs();
    expect(screen.getByRole("img", { name: "Missing documents" })).toBeTruthy();
  });

  // arv-next hid the whole component, the content slot included, when it had a single tab.
  it("renders with a single tab", () => {
    const Owner = defineComponent({
      components: { Tabs },
      setup: () => ({ one: [{ value: "a", label: "Only" }], current: ref("a") }),
      template: `<Tabs v-model="current" :tabs="one"><p>content</p></Tabs>`,
    });
    render(Owner);

    expect(screen.getByRole("tab", { name: "Only" })).toBeTruthy();
    expect(screen.getByText("content")).toBeTruthy();
  });

  it("navigates for a tab with a route and is active while on it", async () => {
    const view = defineComponent({ render: () => h("div") });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { name: "a", path: "/a", component: view },
        { name: "b", path: "/b", component: view },
      ],
    });
    await router.push("/a");
    const routed: TabItem<string>[] = [
      { value: "a", label: "Alpha", to: { name: "a" } },
      { value: "b", label: "Beta", to: { name: "b" } },
    ];
    render(Tabs, { props: { tabs: routed }, global: { plugins: [router] } });

    expect(screen.getByRole("tab", { name: "Alpha" }).getAttribute("aria-selected")).toBe("true");
    await fireEvent.click(screen.getByRole("tab", { name: "Beta" }));
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe("b"));
    await nextTick();
    expect(screen.getByRole("tab", { name: "Beta" }).getAttribute("aria-selected")).toBe("true");
  });

  it("explains itself when a tab has a route but the app has no router", () => {
    const error = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => render(Tabs, { props: { tabs: [{ value: "a", label: "A", to: "/a" }] } })).toThrow(/no router is installed/);
    error.mockRestore();
  });

  describe("scope on a compact screen", () => {
    let media: ReturnType<typeof mockMedia>;
    beforeEach(() => {
      media = mockMedia({ compact: true });
    });
    afterEach(() => media.restore());

    it("turns into a row of capsules using the short labels", () => {
      mountTabs({ presentation: "scope" });
      expect(screen.getByRole("tab", { name: /^History/ }).className).toContain("rounded-full");
    });
  });
});

describe("SwipeActions", () => {
  const actions = [
    { key: "call", label: "Call", icon: "save", href: "tel:+38512345", tone: "positive" },
    { key: "mail", label: "E-mail", icon: "save", href: "mailto:a@b.hr", tone: "info" },
  ] as const;

  const touch = (type: string, x: number, y = 0) =>
    new PointerEvent(type, { pointerType: "touch", clientX: x, clientY: y, bubbles: true, cancelable: true });

  function mountRow(onRowClick = vi.fn()) {
    const { container } = render(SwipeActions, {
      props: { actions },
      slots: { default: `<button data-row>Row</button>` },
      attrs: { onClick: onRowClick },
    });
    const slide = container.querySelector<HTMLElement>(".touch-pan-y")!;
    return { container, slide, onRowClick };
  }

  it("keeps its actions out of the tab order until opened", () => {
    const { container } = mountRow();
    const links = container.querySelectorAll("a");

    expect(links).toHaveLength(2);
    links.forEach((link) => expect(link.getAttribute("tabindex")).toBe("-1"));
  });

  it("opens on a leftward touch drag past half and slides the row", async () => {
    const { slide, container } = mountRow();

    slide.dispatchEvent(touch("pointerdown", 200));
    slide.dispatchEvent(touch("pointermove", 100));
    slide.dispatchEvent(touch("pointerup", 100));
    await nextTick();

    expect(slide.style.transform).toBe("translateX(-152px)");
    container.querySelectorAll("a").forEach((link) => expect(link.getAttribute("tabindex")).toBe("0"));
  });

  it("never drags for a mouse", async () => {
    const { slide } = mountRow();
    slide.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "mouse", clientX: 200, bubbles: true }));
    slide.dispatchEvent(new PointerEvent("pointermove", { pointerType: "mouse", clientX: 50, bubbles: true }));
    await nextTick();

    expect(slide.style.transform).toBe("translateX(0px)");
  });

  it("swallows the click that ends a drag, and a tap on an open row closes it", async () => {
    const { slide, onRowClick } = mountRow();
    slide.dispatchEvent(touch("pointerdown", 200));
    slide.dispatchEvent(touch("pointermove", 100));
    slide.dispatchEvent(touch("pointerup", 100));
    await nextTick();

    await fireEvent.click(screen.getByText("Row"));
    expect(onRowClick).not.toHaveBeenCalled();
    expect(slide.style.transform).toBe("translateX(-152px)");

    await fireEvent.click(screen.getByText("Row"));
    expect(slide.style.transform).toBe("translateX(0px)");
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("keeps one row open at a time", async () => {
    const first = mountRow();
    const second = mountRow();

    first.slide.dispatchEvent(touch("pointerdown", 200));
    first.slide.dispatchEvent(touch("pointermove", 100));
    first.slide.dispatchEvent(touch("pointerup", 100));
    await nextTick();
    second.slide.dispatchEvent(touch("pointerdown", 200));
    second.slide.dispatchEvent(touch("pointermove", 100));
    second.slide.dispatchEvent(touch("pointerup", 100));
    await nextTick();

    expect(first.slide.style.transform).toBe("translateX(0px)");
    expect(second.slide.style.transform).toBe("translateX(-152px)");
  });
});
