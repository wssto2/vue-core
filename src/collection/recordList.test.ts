import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { createMemoryHistory, createRouter, RouterView, useRoute } from "vue-router";
import { ResourcePage, useRouteResource } from "../resource";
import { createTestI18n } from "../testing/i18n";
import { mockMedia } from "../testing/media";
import { defineCollection } from "./definition";
import { useCollectionNeighbors } from "./neighbors";
import { encodeState } from "./state";
import { fakeLoader, flush, page, type Row } from "./testing";

// V5 <-> V6: the collection's neighbors are the record page's list context, through one pager.
const ALL: Row[] = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, title: `Ticket ${index + 1}` }));

let media: ReturnType<typeof mockMedia>;
beforeEach(() => void (media = mockMedia()));
afterEach(() => {
  media.restore();
  document.body.innerHTML = "";
});

async function openRecord(id: number) {
  const loader = fakeLoader((query) => page(ALL.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), { page: query.page, pageSize: query.pageSize, total: ALL.length, lastPage: Math.ceil(ALL.length / query.pageSize) }));
  const definition = defineCollection({ id: "tickets", stateVersion: 1, load: loader.load, key: (row: Row) => row.id, query: { sorts: ["title"], filters: [], views: [] }, defaults: { pageSize: 5, sort: "title" } });
  const from = encodeState(definition, { ...definition.defaults, page: 2 } as never);

  const Record = defineComponent({
    setup() {
      const route = useRoute();
      const ticket = useRouteResource({ param: "recordID", load: async (recordID) => ALL[recordID - 1]! });
      const neighbors = useCollectionNeighbors(definition, { current: () => route.params.recordID as string, list: { name: "list" }, param: "recordID", backLabel: "Tickets" });
      return () => h(ResourcePage, { resource: ticket, title: ticket.data.value?.title ?? "Ticket", list: neighbors.context }, { default: ({ record }: { record: Row }) => h("p", record.title) });
    },
  });
  const view = defineComponent({ render: () => h("p") });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/list", name: "list", component: view },
      { path: "/records/:recordID", name: "record", component: Record },
    ],
  });
  await router.push(`/records/${id}?from=${from}`);
  render(defineComponent({ render: () => h(RouterView) }), { global: { plugins: [router, createTestI18n("en")] }, container: document.body.appendChild(document.createElement("div")) });
  await flush();
  return { router, from };
}

describe("a record opened from a collection", () => {
  it("leads back to the list with its state and pages through the records with one pager", async () => {
    const { router, from } = await openRecord(6);

    expect(screen.getByRole("link", { name: /Tickets/ }).getAttribute("href")).toContain(`query=${encodeURIComponent(from)}`);
    expect(screen.getByRole("navigation", { name: "Records" }).textContent).toContain("6 / 12");
    expect(document.querySelectorAll("[data-test=record-pager]")).toHaveLength(1);

    await fireEvent.click(screen.getByRole("link", { name: "Next record" }));
    await flush();
    expect(router.currentRoute.value.params.recordID).toBe("7");
    expect(screen.getByRole("navigation", { name: "Records" }).textContent).toContain("7 / 12");
  });

  it("steps with J / K and the arrows, but not while typing in a field", async () => {
    const { router } = await openRecord(6);

    await fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    await flush();
    expect(router.currentRoute.value.params.recordID).toBe("5");
    await fireEvent.keyDown(document.body, { key: "j" });
    await flush();
    expect(router.currentRoute.value.params.recordID).toBe("6");
    await fireEvent.keyDown(document.body, { key: "k" });
    await flush();
    expect(router.currentRoute.value.params.recordID).toBe("5");

    const field = document.body.appendChild(document.createElement("input"));
    field.focus();
    await fireEvent.keyDown(field, { key: "j" });
    await flush();
    expect(router.currentRoute.value.params.recordID).toBe("5");
  });
});
