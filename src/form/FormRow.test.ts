import { render } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import { createTestI18n } from "../testing/i18n";
import FormGroup from "./FormGroup.vue";
import FormRow from "./FormRow.vue";

const global = { plugins: [createTestI18n()], stubs: { RouterLink: true } };

describe("FormRow in a narrow group", () => {
  const mount = (layout: "entry" | "setting" | "value") => {
    const { container } = render({ components: { FormGroup, FormRow }, template: `<FormGroup><FormRow label="Label" layout="${layout}">v</FormRow></FormGroup>` }, { global });
    return container;
  };

  it("makes the group a size container and lets an entry row stack under 30rem, label above in the stacked look", () => {
    const container = mount("entry");
    expect(container.querySelector("[data-test='form-group']")?.className).toContain("@container");
    const body = container.querySelector(".row-body > div") as HTMLElement;
    expect(body.className).toContain("@max-[30rem]:grid-cols-1");
    expect(body.className).toContain("grid-cols-[var(--form-label-width,11rem)_minmax(0,1fr)]");
    expect(body.className).toContain("compact:grid-cols-[minmax(0,auto)_minmax(40%,1fr)]");
    expect(container.querySelector("span.break-words")?.className).toContain("@max-[30rem]:text-footnote");
  });

  it("leaves setting and value rows alone", () => {
    for (const layout of ["setting", "value"] as const) {
      const container = mount(layout);
      expect(container.querySelector(".row-body")?.innerHTML).not.toContain("@max-");
    }
  });
});
