import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { createTestI18n } from "../testing/i18n";
import DiffView from "./DiffView.vue";
import { diffRows, isGap, splitRows, type DiffLine } from "./diff";

const global = { plugins: [createTestI18n()] };
const same = (n: number, from = 1): DiffLine[] => Array.from({ length: n }, (_, i) => ({ op: " ", text: `line ${from + i}` }));
const lines: DiffLine[] = [...same(10), { op: "-", text: "old title" }, { op: "+", text: "new title" }, { op: "+", text: "extra" }, ...same(10, 11)];
const mount = (props: Record<string, unknown> = {}) => render(DiffView, { props: { lines, ...props }, global });

afterEach(() => (document.body.innerHTML = ""));

describe("diffRows", () => {
  it("numbers old and new lines separately", () => {
    const rows = diffRows([{ op: " ", text: "a" }, { op: "-", text: "b" }, { op: "+", text: "c" }, { op: " ", text: "d" }], null);
    expect(rows.map((row) => (isGap(row) ? null : [row.oldNo, row.newNo]))).toEqual([[1, 1], [2, null], [null, 2], [3, 3]]);
  });

  it("folds runs of unchanged lines farther than the context from a change, keeping a one-line run", () => {
    const rows = diffRows(lines, 3);
    const gaps = rows.filter(isGap);
    expect(gaps.map((gap) => gap.lines.length)).toEqual([7, 7]);
    expect(rows.filter((row) => !isGap(row)).length).toBe(9);
    expect(diffRows([{ op: " ", text: "a" }, { op: " ", text: "b" }, { op: "+", text: "c" }], 1).some(isGap)).toBe(false);
  });

  it("pairs removed lines with the added lines that follow, in the split view", () => {
    const rows = splitRows(diffRows([{ op: "-", text: "a" }, { op: "-", text: "b" }, { op: "+", text: "c" }], null));
    expect(rows.map((row) => (isGap(row) ? "gap" : [row.left?.text ?? null, row.right?.text ?? null]))).toEqual([["a", "c"], ["b", null]]);
  });
});

describe("DiffView", () => {
  it("shows a unified diff with line numbers, signs and screen-reader text for what changed", () => {
    mount({ context: null });
    const removed = document.querySelector('[data-op="-"]')!;
    const added = Array.from(document.querySelectorAll('[data-op="+"]'));
    expect(removed.textContent).toContain("removed: old title");
    expect(added.map((row) => row.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("added: new title"), expect.stringContaining("added: extra")]));
    expect(removed.querySelector(".sr-only")!.textContent).toBe("removed: ");
    // unchanged lines say nothing extra
    expect(document.querySelector('[data-op=" "]')!.querySelector(".sr-only")).toBeNull();
    // the visible sign is hidden from screen readers (the text says it)
    expect(removed.querySelector("[aria-hidden=true]")).not.toBeNull();
    expect(removed.querySelectorAll("td")[0]!.textContent).toBe("11");
  });

  it("collapses unchanged runs and opens one on click", async () => {
    mount();
    const gaps = screen.getAllByRole("button", { name: "7 unchanged lines" });
    expect(gaps).toHaveLength(2);
    expect(screen.queryByText("line 1")).toBeNull();
    await fireEvent.click(gaps[0]!);
    expect(screen.getByText("line 1")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "7 unchanged lines" })).toHaveLength(1);
  });

  it("does not collapse with context null", () => {
    mount({ context: null });
    expect(document.querySelector("[data-diff-gap]")).toBeNull();
  });

  it("draws the old text left and the new text right in split mode", () => {
    mount({ mode: "split", context: 0 });
    expect(document.querySelector("[data-diff-view]")!.getAttribute("data-mode")).toBe("split");
    const row = Array.from(document.querySelectorAll("tr")).find((tr) => tr.textContent!.includes("old title"))!;
    const cells = Array.from(row.querySelectorAll("td")).map((td) => td.textContent!.trim());
    expect(cells.join("|")).toContain("removed: old title");
    expect(cells.join("|")).toContain("added: new title");
    expect(row.querySelectorAll("td")).toHaveLength(6);
  });

  it("says so when nothing changed", () => {
    mount({ lines: same(3) });
    expect(screen.getByRole("status").textContent).toBe("No differences.");
  });
});
