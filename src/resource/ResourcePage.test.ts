import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, type Component } from "vue";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { useShortcutRegistry } from "../button";
import { ApiError } from "../client";
import { RecordHeader } from "../page";
import { deferred } from "../platform/testing";
import { createTestI18n } from "../testing/i18n";
import { mockMedia } from "../testing/media";
import type { RecordListContext } from "./listContext";
import ResourcePage from "./ResourcePage.vue";
import { useRouteResource } from "./routeResource";

interface Ticket {
  readonly id: number;
  readonly subject: string;
}
const ticket = (id: number, subject = `Ticket ${id}`): Ticket => ({ id, subject });
const i18n = createTestI18n();
const byTest = (id: string) => document.querySelector(`[data-test="${id}"]`);
const settle = async () => {
  for (let index = 0; index < 5; index++) await new Promise((resolve) => setTimeout(resolve, 0));
};

let media: ReturnType<typeof mockMedia>;
beforeEach(() => {
  media = mockMedia();
});
afterEach(() => {
  media.restore();
  document.body.innerHTML = "";
});

interface PageOptions {
  load: (id: number) => Promise<Ticket>;
  list?: RecordListContext;
  pagerSlot?: boolean;
  withHeader?: boolean;
  withLoading?: boolean;
  back?: { label: string; to: string };
}

const captured: { resource?: ReturnType<typeof useRouteResource<Ticket>> } = {};

async function openPage(path: string, options: PageOptions) {
  const Page = defineComponent({
    setup() {
      const resource = useRouteResource({ param: "ticketID", load: options.load });
      captured.resource = resource;
      const title = () => resource.data.value?.subject ?? "Ticket";
      return () =>
        h(
          ResourcePage,
          { resource, title: title(), list: options.list, back: options.back },
          {
            default: ({ record }: { record: Ticket }) => h("p", { "data-test": "content" }, `content of ${record.subject}`),
            ...(options.withHeader === false ? {} : { header: ({ record }: { record: Ticket }) => h(RecordHeader, { title: `Header ${record.subject}` }) }),
            ...(options.withLoading ? { loading: () => h("p", { "data-test": "custom-loading" }, "custom skeleton") } : {}),
            ...(options.pagerSlot ? { pager: () => h("p", { "data-test": "custom-pager" }, "my pager") } : {}),
          },
        );
    },
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/tickets", name: "list", component: defineComponent({ render: () => h("p", "list") }) },
      { path: "/tickets/:ticketID", component: Page as Component },
    ],
  });
  await router.push(path);
  const view = render(defineComponent({ render: () => h(RouterView) }), { global: { plugins: [router, i18n] }, container: document.body.appendChild(document.createElement("div")) });
  return { ...view, router };
}

describe("ResourcePage", () => {
  it("shows the plain title and a skeleton while the record is read, then the header and the content with the loaded record", async () => {
    const read = deferred<Ticket>();
    await openPage("/tickets/5", { load: () => read.promise });
    expect(document.querySelector("[data-async=loading]")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Ticket");
    expect(byTest("content")).toBeNull();

    read.resolve(ticket(5, "Printer on fire"));
    await settle();
    expect(document.querySelector("[data-async=loading]")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Header Printer on fire");
    expect(byTest("content")!.textContent).toBe("content of Printer on fire");
  });

  it("uses the page's own loading slot", async () => {
    await openPage("/tickets/5", { load: () => new Promise(() => {}), withLoading: true });
    expect(document.querySelector("[data-async=loading]")?.contains(byTest("custom-loading"))).toBe(true);
    expect(document.querySelectorAll("[data-async=loading] > *")).toHaveLength(1);
  });

  it("shows the plain title as the header when the page brings no header of its own", async () => {
    await openPage("/tickets/5", { load: async (id) => ticket(id, "Plain"), withHeader: false });
    await settle();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Plain");
    expect(byTest("content")!).toBeTruthy();
  });

  it("shows a not-found state for a missing record and for an invalid address, never the content, and never asks for retry", async () => {
    await openPage("/tickets/5", { load: async () => { throw new ApiError({ kind: "notFound", message: "no", status: 404 }); } });
    await settle();
    expect(screen.getByText("Not found")).toBeTruthy();
    expect(screen.getByText("The record could not be found.")).toBeTruthy();
    expect(byTest("content")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("does not ask for a record of an invalid address", async () => {
    const load = vi.fn(async (id: number) => ticket(id));
    await openPage("/tickets/abc", { load });
    await settle();
    expect(load).not.toHaveBeenCalled();
    expect(screen.getByText("Not found")).toBeTruthy();
  });

  it("shows a failed read with a retry that reads again", async () => {
    let fails = true;
    const load = vi.fn(async (id: number) => {
      if (fails) throw new ApiError({ kind: "server", message: "boom", status: 500 });
      return ticket(id);
    });
    await openPage("/tickets/5", { load });
    await settle();
    expect(screen.getByRole("alert").textContent).toContain("An error occurred while loading data. Please try again.");
    expect(byTest("content")).toBeNull();

    fails = false;
    await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await settle();
    expect(byTest("content")!.textContent).toBe("content of Ticket 5");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps the record on screen while it is read again, and when that read fails offers a retry beside it", async () => {
    let calls = 0;
    const second = deferred<Ticket>();
    await openPage("/tickets/5", { load: (id) => (++calls === 1 ? Promise.resolve(ticket(id)) : calls === 2 ? second.promise : Promise.reject(new Error("down"))) });
    await settle();
    const reading = captured.resource!.reload();
    await nextTick();
    expect(byTest("content")?.textContent).toBe("content of Ticket 5");
    expect(document.querySelector("[data-async=stale]")?.textContent).toContain("Refreshing");
    second.resolve(ticket(5, "Newer"));
    await reading;
    await settle();
    expect(byTest("content")?.textContent).toBe("content of Newer");

    await captured.resource!.reload();
    await settle();
    expect(byTest("content")).toBeTruthy();
    expect(document.querySelector("[data-async=failed]")).toBeTruthy();
  });

  it("passes the list's back, its pager and stays usable without a list", async () => {
    const list: RecordListContext = {
      back: { label: "Tickets", to: "/tickets" },
      neighbors: { position: 2, total: 9, previous: "/tickets/4", next: "/tickets/6" },
    };
    await openPage("/tickets/5", { load: async (id) => ticket(id), list });
    await settle();
    expect(screen.getByRole("link", { name: /Tickets/ }).getAttribute("href")).toBe("/tickets");
    const pager = screen.getByRole("navigation", { name: "Records" });
    expect(pager.textContent).toContain("2 / 9");
    expect(screen.getByRole("link", { name: "Previous record" }).getAttribute("href")).toBe("/tickets/4");
    expect(screen.getByRole("link", { name: "Next record" }).getAttribute("href")).toBe("/tickets/6");
  });

  it("lists the pager's keys for a help dialog", async () => {
    const list: RecordListContext = { back: { label: "Tickets", to: "/tickets" }, neighbors: { position: 2, total: 9, previous: "/tickets/4", next: "/tickets/6" } };
    await openPage("/tickets/5", { load: async (id) => ticket(id), list });
    await settle();
    const rows = useShortcutRegistry().value;
    expect(rows).toContainEqual({ group: "record", label: "Next record", keys: [["J"], ["→"]] });
    expect(rows).toContainEqual({ group: "record", label: "Previous record", keys: [["K"], ["←"]] });
  });

  it("has no pager for a direct link, a back of its own, and a pager slot that replaces the list's", async () => {
    const direct = await openPage("/tickets/5", { load: async (id) => ticket(id), back: { label: "All tickets", to: "/tickets" } });
    await settle();
    expect(screen.queryByRole("navigation", { name: "Records" })).toBeNull();
    expect(screen.getByRole("link", { name: /All tickets/ })).toBeTruthy();
    direct.unmount();
    document.body.innerHTML = "";

    const list: RecordListContext = { back: { label: "Tickets", to: "/tickets" }, neighbors: { position: 1, total: 2, previous: null, next: "/tickets/6" } };
    await openPage("/tickets/5", { load: async (id) => ticket(id), list, pagerSlot: true });
    await settle();
    expect(byTest("custom-pager")!).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Records" })).toBeNull();
    await nextTick();
  });

  it("disables the pager at the ends of the list", async () => {
    const list: RecordListContext = { back: { label: "Tickets", to: "/tickets" }, neighbors: { position: 1, total: 2, previous: null, next: "/tickets/6" } };
    await openPage("/tickets/5", { load: async (id) => ticket(id), list });
    await settle();
    expect(screen.queryByRole("link", { name: "Previous record" })).toBeNull();
    expect(screen.getByRole("link", { name: "Next record" })).toBeTruthy();
  });
});
