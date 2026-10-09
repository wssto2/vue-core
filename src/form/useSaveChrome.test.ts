import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, type App } from "vue";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import AdaptivePageShell from "../page/AdaptivePageShell.vue";
import { settle } from "../testing";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import { mockMedia } from "../testing/media";
import { createLeaveGuard, leaveGuardKey } from "./leaveGuard";
import LeaveGuardRoot from "./LeaveGuardRoot.vue";
import { useForm } from "./useForm";
import { useSaveChrome, type SaveChromeOptions } from "./useSaveChrome";

const i18n = createTestI18n();
let media: ReturnType<typeof mockMedia>;
beforeEach(() => (media = mockMedia()));
afterEach(() => {
  media.restore();
  document.body.innerHTML = "";
});

async function open(options: (form: ReturnType<typeof makeForm>) => Omit<SaveChromeOptions, "form" | "save">) {
  const save = vi.fn();
  let form!: ReturnType<typeof makeForm>;
  const Section = defineComponent({
    setup() {
      useSaveChrome({ form, save, ...options(form) });
      return () => h("p", "section");
    },
  });
  const Page = defineComponent({
    setup() {
      form = makeForm();
      return () => h(AdaptivePageShell, { title: "Dealer", back: { label: "Back", to: "/" } }, () => h(Section));
    },
  });
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/", component: Page }] });
  await router.push("/");
  render(defineComponent({ render: () => h("div", [h(RouterView), h(LeaveGuardRoot)]) }), {
    global: { plugins: [router, i18n, testFormatting(i18n), { install: (app: App) => app.provide(leaveGuardKey, createLeaveGuard()) }], stubs: { transition: false } },
  });
  await settle();
  return { form: () => form, save };
}
const makeForm = () => useForm({ defaults: () => ({ name: "" }) });
const saveButton = () => screen.getAllByRole("button", { name: "Save" })[0] as HTMLButtonElement;

describe("useSaveChrome", () => {
  it("disables Save while the form has no changes, and enables it after an edit", async () => {
    const { form, save } = await open(() => ({}));
    expect(saveButton().disabled).toBe(true);
    form().values.name = "Acme";
    await settle();
    expect(saveButton().disabled).toBe(false);
    await fireEvent.click(saveButton());
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("keeps Save enabled on a clean form with disabledWhileClean: false (a create page)", async () => {
    await open(() => ({ disabledWhileClean: false }));
    expect(saveButton().disabled).toBe(false);
  });

  it("has no Cancel without a cancel, and one with it", async () => {
    const without = await open(() => ({}));
    without.form().values.name = "Acme";
    await settle();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    document.body.innerHTML = "";

    const withCancel = await open(() => ({ cancel: () => {} }));
    withCancel.form().values.name = "Acme";
    await settle();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });
});
