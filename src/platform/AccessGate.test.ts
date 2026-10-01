import { render, within } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, shallowRef } from "vue";
import { createAccessClient, type AccessSnapshot } from "./access";
import AccessGate from "./AccessGate.vue";
import { platformKey } from "./platform";
import { accessOf, held } from "./testing";

const grants = (...names: string[]) => accessOf(Object.fromEntries(names.map((name) => [name, held("organization", undefined)])));

function mountGate(props: Record<string, unknown>, ...names: string[]) {
  const snapshot = shallowRef<AccessSnapshot>(grants(...names));
  const access = createAccessClient(() => snapshot.value);
  const host = defineComponent({
    render: () => h(AccessGate as never, props, { default: () => h("p", "content"), fallback: () => h("p", "request access") }),
  });
  const view = render(host, { global: { provide: { [platformKey as symbol]: { access } } } });
  const scoped = within(view.container as HTMLElement); // several mounts per test share document.body
  return { ...view, ...scoped, grant: async (...more: string[]) => { snapshot.value = grants(...more); await nextTick(); } };
}

describe("AccessGate", () => {
  it("shows the content for a held permission and the fallback otherwise", () => {
    expect(mountGate({ permission: "a:view" }, "a:view").queryByText("content")).not.toBeNull();
    const denied = mountGate({ permission: "a:view" }, "b:view");
    expect(denied.queryByText("content")).toBeNull();
    expect(denied.queryByText("request access")).not.toBeNull();
  });

  it("any needs one, all needs every permission", () => {
    expect(mountGate({ any: ["a:view", "b:view"] }, "b:view").queryByText("content")).not.toBeNull();
    expect(mountGate({ any: ["a:view", "b:view"] }, "c:view").queryByText("content")).toBeNull();
    expect(mountGate({ all: ["a:view", "b:view"] }, "a:view").queryByText("content")).toBeNull();
    expect(mountGate({ all: ["a:view", "b:view"] }, "a:view", "b:view").queryByText("content")).not.toBeNull();
  });

  it("follows the session when access is refreshed", async () => {
    const view = mountGate({ permission: "a:view" });
    expect(view.queryByText("content")).toBeNull();
    await view.grant("a:view");
    expect(view.queryByText("content")).not.toBeNull();
  });

  it("fails loudly when no requirement is given", () => {
    const quiet = () => undefined;
    expect(() => render(defineComponent({ render: () => h(AccessGate as never) }), {
      global: { provide: { [platformKey as symbol]: { access: createAccessClient(() => null) } }, config: { warnHandler: quiet } },
    })).toThrow(/needs one of/);
  });
});
