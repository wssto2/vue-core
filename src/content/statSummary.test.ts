import { render } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import StatSummary, { type StatItem } from "./StatSummary.vue";

const i18n = createTestI18n();
const global = { plugins: [i18n, testFormatting(i18n)] };

const items: StatItem[] = [
  { key: "fetched", label: "Fetched", value: 4120, compact: false },
  { key: "promoted", label: "Published", value: 391, tone: "success", share: 94.9 },
  { key: "failed", label: "Failed", value: 14, tone: "danger", share: 0 },
  { key: "pending", label: "Pending", value: 7, tone: "warning", share: 140 },
];

const cell = (container: Element, key: string) => container.querySelector(`[data-stat="${key}"]`)!;

describe("StatSummary", () => {
  it("renders one cell per item with its label, grouped value and tone", () => {
    const { container } = render(StatSummary, { props: { items }, global });
    expect(container.querySelectorAll("[data-stat]")).toHaveLength(4);
    expect(cell(container, "fetched").textContent).toContain("4,120");
    const promoted = cell(container, "promoted");
    expect(promoted.textContent).toContain("Published");
    expect(promoted.querySelector("dd")!.className).toContain("text-status-success-content");
  });

  it("draws a share bar only where a share is given, clamped to 0-100", () => {
    const { container } = render(StatSummary, { props: { items }, global });
    expect(cell(container, "fetched").textContent).not.toContain("%");
    expect(cell(container, "promoted").textContent).toContain("95 %");
    // A zero share is still a share: the cell keeps its bar.
    expect(cell(container, "failed").textContent).toContain("0 %");
    expect(cell(container, "pending").textContent).toContain("100 %");
  });

  it("hides secondary cells on compact screens and lays out by column count", () => {
    const { container } = render(StatSummary, { props: { items, compactColumns: 3 }, global });
    expect(cell(container, "fetched").className).toContain("compact:hidden");
    expect(cell(container, "promoted").className).not.toContain("compact:hidden");
    const style = container.querySelector('[data-test="stat-summary"]')!.getAttribute("style") ?? "";
    expect(style).toContain("--stat-columns: 4");
    expect(style).toContain("--stat-compact-columns: 3");
  });

  it("renders the header and footer rows only when given", () => {
    expect(render(StatSummary, { props: { items }, global }).container.querySelectorAll(".border-b")).toHaveLength(0);
    const { container } = render(StatSummary, { props: { items }, slots: { header: "<span>Last run</span>", footer: "<span>Success rate</span>" }, global });
    expect(container.textContent).toContain("Last run");
    expect(container.textContent).toContain("Success rate");
  });
});
