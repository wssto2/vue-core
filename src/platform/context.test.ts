import { render } from "@testing-library/vue";
import { defineComponent, h, provide } from "vue";
import { describe, expect, it } from "vitest";
import { defineFeatureContext, MissingContextError } from "./context";

interface Dependencies {
  label: string;
}

const Reader = (use: () => Dependencies) =>
  defineComponent({
    setup() {
      const { label } = use();
      return () => h("p", label);
    },
  });

describe("defineFeatureContext", () => {
  it("returns a key and a lookup that reads what an ancestor provided", () => {
    const [key, useThing] = defineFeatureContext<Dependencies>("test.thing");
    const view = render(Reader(useThing), { global: { provide: { [key as symbol]: { label: "installed" } } } });
    expect(view.getByText("installed")).toBeTruthy();
  });

  it("can be overridden for a subtree, like an environment value", () => {
    const [key, useThing] = defineFeatureContext<Dependencies>("test.thing");
    const Child = Reader(useThing);
    const Override = defineComponent({
      setup() {
        provide(key, { label: "override" });
        return () => h(Child);
      },
    });
    const Root = defineComponent({ render: () => h("div", [h(Child), h(Override)]) });
    const view = render(Root, { global: { provide: { [key as symbol]: { label: "app" } } } });
    expect(view.getByText("app")).toBeTruthy();
    expect(view.getByText("override")).toBeTruthy();
  });

  it("throws an error naming the context and how to provide it when nothing did", () => {
    const [, useThing] = defineFeatureContext<Dependencies>("helpdesk.tickets");
    let thrown: unknown;
    try {
      render(Reader(useThing));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(MissingContextError);
    expect((thrown as MissingContextError).contextName).toBe("helpdesk.tickets");
    expect((thrown as Error).message).toMatch(/"helpdesk\.tickets" was not provided.*app\.provide\(key, value\)/);
  });

  it("explains a lookup made outside component setup", () => {
    const [, useThing] = defineFeatureContext<Dependencies>("helpdesk.tickets");
    expect(() => useThing()).toThrow(/"helpdesk\.tickets" can only be read while a component is being set up/);
  });

  it("does not warn about a missing injection before throwing its own error", () => {
    const warnings: string[] = [];
    const [, useThing] = defineFeatureContext<Dependencies>("quiet");
    try {
      render(Reader(useThing), { global: { config: { warnHandler: (message) => warnings.push(message) } } });
    } catch {
      // expected
    }
    expect(warnings.filter((message) => message.includes("injection"))).toEqual([]);
  });

  it("keeps two contexts with the same name apart", () => {
    const [a] = defineFeatureContext<Dependencies>("same");
    const [b, useB] = defineFeatureContext<Dependencies>("same");
    expect(a).not.toBe(b);
    expect(() => render(Reader(useB), { global: { provide: { [a as symbol]: { label: "x" } } } })).toThrow(MissingContextError);
  });
});
