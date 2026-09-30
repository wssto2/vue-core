import { describe, expect, it } from "vitest";
import type { App } from "vue";
import { createLeaveGuard, leaveGuardKey } from "./leaveGuard";
import { withSetup } from "./testing";
import { useForm } from "./useForm";
import { useGroupSheet } from "./useGroupSheet";

const setup = (options: { restore?: readonly ("registered" | "modelYear" | "name")[] } = {}) => {
  const guard = createLeaveGuard();
  const { result } = withSetup(() => {
    const form = useForm({ defaults: () => ({ name: "Golf", registered: "2019-05-01" as string, modelYear: 2019 as number, notes: "" }) });
    const sheet = useGroupSheet({ form, group: "vehicle", fields: ["registered"], restore: options.restore, save: async () => ({ ok: true }) });
    return { form, sheet };
  }, [{ install: (app: App) => app.provide(leaveGuardKey, guard) }]);
  return result;
};

describe("useGroupSheet: cross-group derived fields", () => {
  it("restores the fields that derive from the group's (the model year follows the first registration), not only the group's own", () => {
    const { form, sheet } = setup({ restore: ["registered", "modelYear"] });
    sheet.present();
    form.values.registered = "2021-01-01";
    form.values.modelYear = 2021; // derived by the feature when the registration changed
    expect(sheet.dirty.value).toBe(true);
    sheet.closed();
    expect(form.values.registered).toBe("2019-05-01");
    expect(form.values.modelYear).toBe(2019);
    expect(sheet.open.value).toBe(false);
  });

  it("without `restore` only the group's own fields come back", () => {
    const { form, sheet } = setup();
    sheet.present();
    form.values.registered = "2021-01-01";
    form.values.modelYear = 2021;
    sheet.closed();
    expect(form.values.registered).toBe("2019-05-01");
    expect(form.values.modelYear).toBe(2021);
  });

  it("a sheet with a dedicated save and no refresh takes the saved values as its baseline", async () => {
    const { form, sheet } = setup();
    sheet.present();
    form.values.registered = "2020-02-02";
    expect(await sheet.save()).toBe(true);
    expect(sheet.dirty.value).toBe(false);
    sheet.closed();
    expect(form.values.registered).toBe("2020-02-02");
  });

  it("refuses a full-record save when the form has none and no dedicated save was given", async () => {
    const guard = createLeaveGuard();
    const { result } = withSetup(() => {
      const form = useForm({ defaults: () => ({ a: "" }) });
      return useGroupSheet({ form, group: "g", fields: ["a"] });
    }, [{ install: (app: App) => app.provide(leaveGuardKey, guard) }]);
    await expect(result.save()).rejects.toThrow("no full-record save()");
  });

  it("refuses a rebase without a record form, at creation", () => {
    const guard = createLeaveGuard();
    expect(() =>
      withSetup(() => {
        const form = useForm({ defaults: () => ({ a: "" }) });
        return useGroupSheet({ form, group: "g", fields: ["a"], save: async () => 1, rebase: { reload: async () => undefined, message: () => "" } });
      }, [{ install: (app: App) => app.provide(leaveGuardKey, guard) }]),
    ).toThrow("needs a record form");
  });
});
