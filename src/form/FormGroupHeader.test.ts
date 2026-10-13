import { render } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import { h } from "vue";
import { createTestI18n } from "../testing/i18n";
import FormGroup from "./FormGroup.vue";

describe("a group's header", () => {
  it("aligns its trailing action with the title's baseline, not the bottom of the taller button", () => {
    const { container } = render(FormGroup, { props: { header: "Details" }, slots: { "header-trailing": () => h("button", "Edit"), default: () => h("div", "row") }, global: { plugins: [createTestI18n()] } });
    const header = container.querySelector("header")!;
    expect(header.className).toContain("items-baseline");
    expect(header.className).not.toContain("items-end");
    expect(header.querySelector("h3")?.textContent).toBe("Details");
  });
});
