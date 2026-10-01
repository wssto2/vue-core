import { describe, expect, it } from "vitest";
import { ref, type App } from "vue";
import { createLeaveGuard, leaveGuardKey } from "./leaveGuard";
import { useDirtySnapshot, useSheetDiscardGuard } from "./dirty";
import { cloneValue, sameValue } from "./snapshot";
import { createTestApp, withSetup } from "../testing";

describe("useDirtySnapshot", () => {
  it("is never dirty before the first markClean, so a page that is still loading never asks", () => {
    const value = ref("a");
    const { isDirty } = useDirtySnapshot(() => value.value);
    value.value = "b";
    expect(isDirty.value).toBe(false);
  });

  it("tracks nested changes against the last baseline; a change undone is clean", () => {
    const state = ref({ rows: [{ qty: 1 }], note: "" });
    const { isDirty, markClean } = useDirtySnapshot(() => state.value);
    markClean();
    expect(isDirty.value).toBe(false);
    state.value.rows[0]!.qty = 2;
    expect(isDirty.value).toBe(true);
    state.value.rows[0]!.qty = 1;
    expect(isDirty.value).toBe(false);
    state.value.note = "x";
    markClean();
    expect(isDirty.value).toBe(false);
  });
});

describe("useSheetDiscardGuard", () => {
  const mount = () => {
    const guard = createLeaveGuard();
    guard.attach();
    const name = ref("");
    const { result } = withSetup(() => useSheetDiscardGuard(() => name.value), createTestApp({ plugins: [{ install: (app: App) => app.provide(leaveGuardKey, guard) }] }));
    return { guard, name, sheet: result };
  };

  it("lets a sheet with nothing typed close without asking", async () => {
    const { sheet, guard } = mount();
    sheet.opened();
    expect(await sheet.beforeDismiss()).toBe(true);
    expect(guard.pending.value).toBeNull();
  });

  it("asks when the sheet holds edits, and not once it has closed", async () => {
    const { sheet, guard, name } = mount();
    sheet.opened();
    name.value = "typed";
    const asked = sheet.beforeDismiss();
    expect(guard.pending.value).not.toBeNull();
    guard.pending.value?.resolve(false);
    expect(await asked).toBe(false);
    sheet.closed();
    expect(await sheet.beforeDismiss()).toBe(true);
  });
});

describe("snapshots", () => {
  it("clone shares nothing with the original, keeps dates as dates and files as the same file", () => {
    const file = new File(["x"], "a.txt");
    const source = { at: new Date(0), list: [{ n: 1 }], file };
    const copy = cloneValue(source);
    copy.list[0]!.n = 2;
    expect(source.list[0]!.n).toBe(1);
    expect(copy.at).toBeInstanceOf(Date);
    expect(copy.at).not.toBe(source.at);
    expect(copy.file).toBe(file);
  });

  it("compares by content: undefined is an absent key, NaN equals itself, a different file is different", () => {
    expect(sameValue({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(sameValue({ a: Number.NaN }, { a: Number.NaN })).toBe(true);
    expect(sameValue([1, 2], [1, 2, 3])).toBe(false);
    expect(sameValue({ f: new File(["x"], "a") }, { f: new File(["x"], "a") })).toBe(false);
    expect(sameValue(null, {})).toBe(false);
  });
});
