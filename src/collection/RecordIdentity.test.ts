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

  it("does not reserve subtitle space when there is none", () => {
    const { container } = render(RecordIdentity, { props: { title: "Ada Lovelace" }, global: { plugins: [router] } });
    expect(container.querySelector(".text-row-subtitle")).toBeNull();
  });
});
