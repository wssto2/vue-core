import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import { defineComponent, nextTick, ref } from "vue";
import { createTestI18n } from "../testing/i18n";
import Avatar from "./Avatar.vue";
import Divider from "./Divider.vue";
import { initialsFor } from "./initials";
import KeyValue from "./KeyValue.vue";
import KeyValueList, { type KeyValueItem } from "./KeyValueList.vue";
import MicroLabel from "./MicroLabel.vue";
import Panel from "./Panel.vue";
import Timestamp from "./Timestamp.vue";

const global = { plugins: [createTestI18n("en")] };

describe("initialsFor and Avatar", () => {
  it("takes the first letters of the first and last word", () => {
    expect(initialsFor("Josip Žlimen")).toBe("JŽ");
    expect(initialsFor("Ana Maria Horvat")).toBe("AH");
    expect(initialsFor("madonna")).toBe("M");
    expect(initialsFor("  ")).toBe("?");
    expect(initialsFor(null)).toBe("?");
  });

  it("is decorative and reads the semantic fill", () => {
    const { container } = render(Avatar, { props: { name: "Josip Žlimen", size: "md" } });
    const avatar = container.firstElementChild!;

    expect(avatar.textContent).toBe("JŽ");
    expect(avatar.getAttribute("aria-hidden")).toBe("true");
    expect(avatar.className).toContain("bg-fill");
  });

  it("the anchor tone is the tile role", () => {
    const { container } = render(Avatar, { props: { name: "A B", tone: "anchor", size: "xl" } });
    expect(container.firstElementChild!.className).toContain("bg-tile-anchor");
  });
});

describe("MicroLabel and Divider", () => {
  it("renders the element asked for, with the one micro-label scale and no palette", () => {
    const { container } = render(MicroLabel, { props: { as: "dt" }, slots: { default: "VIN" } });
    const label = container.firstElementChild!;

    expect(label.tagName).toBe("DT");
    expect(label.className).toContain("uppercase");
    expect(label.className).toContain("text-content-muted");
    expect(label.outerHTML).not.toMatch(/text-\[\d|gray-/);
  });

  it("a divider is a separator, optionally with a label", () => {
    render(Divider, { props: { label: "or enter it manually" } });
    expect(screen.getByRole("separator").textContent).toContain("or enter it manually");
  });
});

describe("KeyValue and KeyValueList", () => {
  const items: KeyValueItem[] = [
    { key: "make", label: "Make", value: "Audi" },
    { key: "vin", label: "VIN", value: null },
  ];

  it("renders a dt/dd pair: muted label, medium value", () => {
    const { container } = render(KeyValueList, { props: { items }, global });

    expect(container.querySelectorAll("dt")).toHaveLength(2);
    expect(container.querySelector("[data-key=make] dt")!.className).toContain("text-content-muted");
    expect(container.querySelector("[data-key=make] dd")!.className).toContain("font-medium");
    expect(container.querySelector("[data-key=make] dd")!.textContent).toBe("Audi");
  });

  it("shows a dash for a missing value, read as not entered", () => {
    const { container } = render(KeyValueList, { props: { items }, global });
    const value = container.querySelector("[data-key=vin] dd")!;

    expect(value.querySelector("[aria-hidden='true']")!.textContent).toBe("—");
    expect(value.querySelector(".sr-only")!.textContent).toBe("Not entered");
  });

  it("a zero is a value, not an empty one", () => {
    const { container } = render(KeyValue, { props: { label: "Km", value: 0 }, global });
    expect(container.querySelector("dd")!.textContent).toBe("0");
  });

  it("one column by default, more when asked", () => {
    expect(render(KeyValueList, { props: { items }, global }).container.querySelector("dl")!.className).toContain("grid-cols-1");
    expect(render(KeyValueList, { props: { items, columns: 2 }, global }).container.querySelector("dl")!.className).toContain("sm:grid-cols-2");
    expect(render(KeyValueList, { props: { items, columns: 3 }, global }).container.querySelector("dl")!.className).toContain("lg:grid-cols-3");
  });

  it("lets the value slot take over", () => {
    const { container } = render(KeyValueList, {
      props: { items },
      slots: { value: `<template #value="{ item }"><b class="slotted">{{ item.key }}</b></template>` },
      global,
    });
    expect([...container.querySelectorAll("b.slotted")].map((node) => node.textContent)).toEqual(["make", "vin"]);
  });
});

describe("Timestamp", () => {
  it("formats a date and time for the active locale inside a <time>", () => {
    const { container } = render(Timestamp, { props: { value: "2026-09-30T14:05:00Z" }, global });
    const time = container.querySelector("time")!;

    expect(time.getAttribute("datetime")).toBe("2026-09-30T14:05:00.000Z");
    expect(time.textContent).toMatch(/2026/);
  });

  it("date precision shows no time", () => {
    const { container } = render(Timestamp, { props: { value: "2026-09-30T14:05:00Z", precision: "date" }, global });
    expect(container.querySelector("time")!.textContent).not.toMatch(/:\d\d/);
  });

  // A date without a time is a calendar day: read as UTC midnight it showed the day before west of UTC.
  it("reads a calendar date as that day, in any time zone", () => {
    const { container } = render(Timestamp, { props: { value: "2026-01-01", precision: "date" }, global });
    const time = container.querySelector("time")!;

    expect(time.getAttribute("datetime")).toBe("2026-01-01");
    expect(time.textContent).toMatch(/Jan 1, 2026/);
  });

  it("says there is no data for nothing or for a non-date", () => {
    for (const value of [undefined, null, "", "not a date"]) {
      const { container, unmount } = render(Timestamp, { props: { value }, global });
      expect(container.textContent).toBe("No data");
      expect(container.querySelector("time")).toBeNull();
      unmount();
    }
  });
});

describe("Panel", () => {
  const mount = (props: Record<string, unknown> = {}, slots: Record<string, string> = { default: "<p>Body</p>" }) =>
    render(Panel, { props: { title: "Vehicle data", ...props }, slots });

  it("is a surface with a heading over the body, on semantic roles", () => {
    const { container } = mount({ icon: "save", number: "01", subtitle: "basics" });

    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("Vehicle data");
    expect(container.firstElementChild!.className).toContain("bg-surface-cell");
    expect(container.innerHTML).not.toMatch(/(?:bg|text|border|ring)-(?:gray|white|primary)-?\d*/);
    expect(container.querySelector("button")).toBeNull();
  });

  it("collapsible: the title is one button that owns the expanded state and the body", async () => {
    const { container } = mount({ collapsible: true });
    const button = screen.getByRole("button", { name: /Vehicle data/ });
    const body = container.querySelector<HTMLElement>(`#${button.getAttribute("aria-controls")}`)!;

    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelectorAll("button")).toHaveLength(1);

    await fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(body.style.display).toBe("none");
    // The body stays in the DOM: form state survives a collapse.
    expect(body.textContent).toContain("Body");
  });

  it("follows and reports v-model:collapsed", async () => {
    const Owner = defineComponent({
      components: { Panel },
      setup: () => ({ collapsed: ref(true) }),
      template: `<Panel title="P" collapsible v-model:collapsed="collapsed"><p>Body</p></Panel><output>{{ collapsed }}</output>`,
    });
    render(Owner);
    expect(screen.getByRole("button").getAttribute("aria-expanded")).toBe("false");

    await fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("status").textContent).toBe("false");
  });

  it("exposes toggle, expand and collapse for a jump link", async () => {
    const Owner = defineComponent({
      components: { Panel },
      setup: () => ({ panel: ref<InstanceType<typeof Panel> | null>(null) }),
      template: `<button id="go" @click="panel?.collapse()">c</button><button id="open" @click="panel?.expand()">e</button><Panel ref="panel" title="P" collapsible><p>Body</p></Panel>`,
    });
    const { container } = render(Owner);
    const toggle = () => screen.getByRole("button", { name: "P" });

    await fireEvent.click(container.querySelector("#go")!);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    await fireEvent.click(container.querySelector("#open")!);
    await nextTick();
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
  });

  it("a section has no card: a number in the tint and a heading", () => {
    const { container } = mount({ presentation: "section", number: "02", headingLevel: 3 });

    expect(container.firstElementChild!.className).not.toContain("bg-surface-cell");
    expect(screen.getByRole("heading", { level: 3 }).textContent).toContain("02");
    expect(container.querySelector(".text-content-link")!.textContent).toBe("02");
  });

  it("shows the footer only while expanded, and takes attributes on its root", async () => {
    const { container } = render(Panel, {
      props: { title: "P", collapsible: true },
      attrs: { id: "contact" },
      slots: { default: "<p>Body</p>", footer: "<span>Footer</span>" },
    });

    expect(container.firstElementChild!.id).toBe("contact");
    expect(screen.getByText("Footer")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByText("Footer")).toBeNull();
  });
});
