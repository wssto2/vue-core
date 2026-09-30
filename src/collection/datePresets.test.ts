import { render } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { createTestI18n } from "../testing/i18n";
import { useDatePresetFilter } from "./datePresets";
import type { FilterDescriptor } from "./filters";

describe("useDatePresetFilter", () => {
  it("offers go-core's date presets with translated labels", () => {
    let filter!: FilterDescriptor<"created_at">;
    const i18n = createTestI18n("hr");
    render(defineComponent({ setup() { filter = useDatePresetFilter("created_at"); return () => h("div"); } }), { global: { plugins: [i18n] } });
    expect(filter.key).toBe("created_at");
    expect(filter.type).toBe("select");
    expect(filter.options?.map((option) => option.value)).toEqual(["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "this_year", "last_year"]);
    expect(filter.options?.[0]?.label).toBe("Danas");
    expect(filter.label).toBe("Uneseno");
  });
});
