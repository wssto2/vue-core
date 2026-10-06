import { render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import RecordIdentity from "./RecordIdentity.vue";

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: "/", component: defineComponent({ render: () => h("div") }) },
    { path: "/leads/:leadID", name: "lead", component: defineComponent({ render: () => h("div") }) },
  ],
});

describe("RecordIdentity", () => {
  it("uses the shared row typography for a plain title and its subtitle", () => {
    render(RecordIdentity, { props: { title: "Ada Lovelace", subtitle: "ada@example.com" }, global: { plugins: [router] } });
    expect(screen.getByText("Ada Lovelace").className).toContain("text-row-title");
    expect(screen.getByText("ada@example.com").className).toContain("text-row-subtitle");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links the title to the record and keeps a selectable subtitle outside the link", () => {
    render(RecordIdentity, {
      props: { title: "Ada Lovelace", subtitle: "+385 91 555 0101", to: { name: "lead", params: { leadID: 7 } }, subtitleSelectable: true },
      global: { plugins: [router] },
    });
    expect(screen.getByRole("link", { name: "Ada Lovelace" }).getAttribute("href")).toBe("/leads/7");
    const subtitle = screen.getByText("+385 91 555 0101");
    expect(subtitle.hasAttribute("data-row-click-ignore")).toBe(true);
    expect(subtitle.className).toContain("select-text");
    expect(subtitle.closest("a")).toBeNull();
  });

  it("as cells of its parent grid (spread): no box of its own, the subtitle spans the full width of the second row", () => {
    const { container } = render(RecordIdentity, { props: { title: "Ada Lovelace", subtitle: "ada@example.com", spread: true }, global: { plugins: [router] } });
    expect(container.firstElementChild!.className).toBe("contents");
    expect(screen.getByText("Ada Lovelace").className).toContain("col-start-1 row-start-1");
    expect(screen.getByText("ada@example.com").className).toContain("col-span-full row-start-2");
  });

  it("is a column of its own by default, unchanged", () => {
    const { container } = render(RecordIdentity, { props: { title: "Ada Lovelace", subtitle: "ada@example.com" }, global: { plugins: [router] } });
    expect(container.firstElementChild!.className).toBe("flex min-w-0 flex-col");
    expect(screen.getByText("ada@example.com").className).not.toContain("col-span-full");
  });

  it("does not reserve subtitle space when there is none", () => {
    const { container } = render(RecordIdentity, { props: { title: "Ada Lovelace" }, global: { plugins: [router] } });
    expect(container.querySelector(".text-row-subtitle")).toBeNull();
  });

  it("marks where the search matched the title, for the link and the plain title alike", () => {
    const { container } = render(RecordIdentity, { props: { title: "Ada Lovelace", to: { name: "lead", params: { leadID: 7 } }, highlight: " LOVE ada " }, global: { plugins: [router] } });
    expect([...container.querySelectorAll("mark")].map((mark) => mark.textContent)).toEqual(["Ada", "Love"]);
    expect(screen.getByRole("link").textContent).toBe("Ada Lovelace");
  });

  it("marks nothing without a search or a match", () => {
    const { container } = render(RecordIdentity, { props: { title: "Ada Lovelace", highlight: "zzz" }, global: { plugins: [router] } });
    expect(container.querySelector("mark")).toBeNull();
    const plain = render(RecordIdentity, { props: { title: "Ada Lovelace" }, global: { plugins: [router] } });
    expect(plain.container.querySelector("mark")).toBeNull();
  });
});
