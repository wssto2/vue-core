import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import { defineComponent, h, ref } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { createTestI18n } from "../testing/i18n";
import type { CollectionNeighbors, Neighbor } from "./neighbors";
import NeighborPager from "./NeighborPager.vue";
import { flush } from "./testing";

const view = defineComponent({ render: () => h("div") });
const make = async () => {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/r/:id", name: "record", component: view }] });
  await router.push("/r/5");
  const neighbors = {
    position: ref<number | null>(5),
    total: ref(12),
    previous: ref<Neighbor | null>({ key: 4, to: { name: "record", params: { id: "4" } } }),
    next: ref<Neighbor | null>({ key: 6, to: { name: "record", params: { id: "6" } } }),
    loading: ref(false),
    listRoute: ref(null),
  };
  const view2 = render(NeighborPager, { props: { neighbors: neighbors as unknown as CollectionNeighbors }, global: { plugins: [router, createTestI18n("en")] } });
  return { ...view2, router, neighbors };
};

describe("NeighborPager", () => {
  it("shows the position and steps with its buttons", async () => {
    const { router } = await make();
    expect(screen.getByText("5 / 12")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await flush();
    expect(router.currentRoute.value.params.id).toBe("6");
  });

  it("steps with the arrows and J / K, but not while typing in a field", async () => {
    const { router } = await make();
    await fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    await flush();
    expect(router.currentRoute.value.params.id).toBe("4");
    await fireEvent.keyDown(document.body, { key: "j" });
    await flush();
    expect(router.currentRoute.value.params.id).toBe("6");
    const field = document.createElement("input");
    document.body.append(field);
    field.focus();
    await fireEvent.keyDown(field, { key: "k" });
    await flush();
    expect(router.currentRoute.value.params.id).toBe("6");
    field.remove();
  });

  it("disables a step where there is nowhere to go, and renders nothing without a position", async () => {
    const { neighbors, rerender } = await make();
    neighbors.next.value = null;
    await flush();
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.keyDown(document.body, { key: "ArrowRight" });
    neighbors.position.value = null;
    await flush();
    expect(screen.queryByRole("navigation")).toBeNull();
    await rerender({ neighbors });
  });
});
