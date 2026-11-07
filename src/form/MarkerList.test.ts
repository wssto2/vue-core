import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { createI18n } from "vue-i18n";
import { coreMessages } from "../i18n";
import { slavicPluralRules } from "../i18n/plural";
import type { CodeMarker } from "./codeEditor";
import MarkerList from "./MarkerList.vue";

const mount = (markers: CodeMarker[], locale = "hr", extra: Record<string, unknown> = {}) =>
  render(MarkerList, { props: { markers, ...extra }, global: { plugins: [createI18n({ legacy: false, locale, fallbackLocale: "en", messages: coreMessages, pluralRules: slavicPluralRules })] } });

const errors = (count: number): CodeMarker[] => Array.from({ length: count }, (_, i) => ({ line: i + 1, severity: "error", message: `e${i + 1}` }));
const warnings = (count: number): CodeMarker[] => Array.from({ length: count }, (_, i) => ({ line: i + 1, severity: "warning", message: `w${i + 1}` }));
const heading = (severity: string) => document.querySelector(`[data-severity=${severity}] h3`)!.textContent!.trim();

afterEach(() => (document.body.innerHTML = ""));

describe("MarkerList", () => {
  it.each([
    [1, "1 greška", "1 upozorenje"],
    [2, "2 greške", "2 upozorenja"],
    [5, "5 grešaka", "5 upozorenja"],
    [21, "21 greška", "21 upozorenje"],
    [12, "12 grešaka", "12 upozorenja"],
  ])("counts %i findings with the Croatian plural form", (count, errorsText, warningsText) => {
    mount([...errors(count), ...warnings(count)]);
    expect(heading("error")).toBe(errorsText);
    expect(heading("warning")).toBe(warningsText);
  });

  it("uses the Slovenian dual and English singular", () => {
    mount(errors(2), "sl");
    expect(heading("error")).toBe("2 napaki");
    document.body.innerHTML = "";
    mount(errors(1), "en");
    expect(heading("error")).toBe("1 error");
  });

  it("lists errors before warnings, each group by line", () => {
    mount([{ line: 9, severity: "warning", message: "late" }, { line: 5, severity: "error", message: "second" }, { line: 2, severity: "error", message: "first" }]);
    expect(Array.from(document.querySelectorAll("[data-severity]")).map((group) => (group as HTMLElement).dataset.severity)).toEqual(["error", "warning"]);
    expect(Array.from(document.querySelectorAll("[data-marker]")).map((button) => Array.from(button.querySelectorAll("span"), (span) => span.textContent).join(" "))).toEqual(["Redak 2 first", "Redak 5 second", "Redak 9 late"]);
  });

  it("says U redu when there is nothing to fix", () => {
    mount([]);
    expect(screen.getByRole("status").textContent).toContain("U redu");
    expect(document.querySelector("[data-marker]")).toBeNull();
  });

  it("selects a finding with the mouse and with the keyboard (native buttons)", async () => {
    const picked: CodeMarker[] = [];
    mount([{ line: 14, column: 8, severity: "error", message: "unknown filter" }], "hr", { onSelect: (marker: CodeMarker) => picked.push(marker) });
    const button = screen.getByRole("button", { name: /Redak 14, stupac 8/ });
    expect(button.tagName).toBe("BUTTON");
    expect((button as HTMLButtonElement).tabIndex).toBe(0);
    await fireEvent.click(button);
    expect(picked).toEqual([{ line: 14, column: 8, severity: "error", message: "unknown filter" }]);
  });
});
