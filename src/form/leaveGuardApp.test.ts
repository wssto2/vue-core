import { fireEvent, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { defineFeature } from "../app";
import { AppRouterView } from "../router";
import { backofficeShell } from "../shell";
import { page, settle, startShell, stopShells } from "../shell/testing";
import { MissingLeaveGuardRootError, useLeaveGuard } from "./leaveGuard";

afterEach(stopShells);

// A page that always has unsaved changes, in a feature that knows nothing about the leave guard's setup.
const dirty = defineComponent({
  setup() {
    useLeaveGuard(() => true);
    return () => h("p", "editor");
  },
});
const editing = defineFeature({
  id: "editing",
  routes: [
    { name: "editor", path: "/editor", component: dirty, meta: { public: true } },
    { name: "elsewhere", path: "/elsewhere", component: page("elsewhere"), meta: { public: true } },
  ],
});

describe("the leave guard of an application", () => {
  it("is available to every page without any setup, and BackofficeShell asks the question", async () => {
    const { application } = await startShell(backofficeShell(), { features: [editing], location: "/editor" });
    const moving = application.router.push("/elsewhere");
    await settle();
    expect(screen.getByRole("alertdialog").textContent).toContain("Unsaved changes");
    await fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));
    await moving;
    expect(application.router.currentRoute.value.path).toBe("/editor");
  });

  it("a shell of its own without <LeaveGuardRoot /> fails clearly when a guarded leave must ask, and the user stays", async () => {
    const { application } = await startShell(defineComponent({ render: () => h(AppRouterView) }), { features: [editing], location: "/editor" });
    await expect(application.router.push("/elsewhere")).rejects.toThrow(MissingLeaveGuardRootError);
    expect(application.router.currentRoute.value.path).toBe("/editor");
  });
});
