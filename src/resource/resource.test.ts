import { render } from "@testing-library/vue";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref, type InjectionKey } from "vue";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { ApiError } from "../client";
import { MissingContextError } from "../platform/context";
import { deferred } from "../platform/testing";
import { createTestI18n } from "../testing/i18n";
import { positiveInteger, useResource } from "./resource";
import { useRouteResource, useRouteResourceContext, type RouteResource } from "./routeResource";

interface Ticket {
  readonly id: number;
  readonly subject: string;
}
const ticket = (id: number, subject = `Ticket ${id}`): Ticket => ({ id, subject });
const TICKET: InjectionKey<RouteResource<Ticket>> = Symbol("ticket");

const i18n = createTestI18n("en");
const settle = async () => {
  for (let index = 0; index < 5; index++) await new Promise((resolve) => setTimeout(resolve, 0));
};

/** A page at /tickets/:ticketID whose load the test steers, with one routed section that reads the context. */
async function openAt(path: string, load: (id: number, signal: AbortSignal) => Promise<Ticket>) {
  const captured: { resource?: RouteResource<Ticket>; section?: RouteResource<Ticket> } = {};
  const Section = defineComponent({
    setup() {
      captured.section = useRouteResourceContext(TICKET);
      return () => h("p", { "data-section": "" }, captured.section?.data.value?.subject ?? "-");
    },
  });
  const Page = defineComponent({
    setup() {
      const resource = useRouteResource({ key: TICKET, param: "ticketID", load: (id, { signal }) => load(id, signal) });
      captured.resource = resource;
      return () => h("main", [h("output", { "data-state": "" }, resource.state.value.status), h(RouterView)]);
    },
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/tickets/:ticketID", component: Page, children: [{ path: "", component: Section }] },
      { path: "/elsewhere", component: defineComponent({ render: () => h("p", "elsewhere") }) },
    ],
  });
  await router.push(path);
  const view = render(defineComponent({ render: () => h(RouterView) }), { global: { plugins: [router, i18n] } });
  const state = () => captured.resource!.state.value;
  return { ...view, router, captured, state, resource: () => captured.resource! };
}

describe("useRouteResource", () => {
  it("loads the record of a direct link once, and hands it to the page's sections through the typed context", async () => {
    const read = deferred<Ticket>();
    const load = vi.fn((_id: number) => read.promise);
    const page = await openAt("/tickets/7", load);
    expect(page.state()).toEqual({ status: "loading" });
    read.resolve(ticket(7));
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0]?.[0]).toBe(7);
    expect(page.state()).toEqual({ status: "loaded", value: ticket(7) });
    expect(page.resource().data.value).toEqual(ticket(7));
    expect(page.container.querySelector("[data-section]")?.textContent).toBe("Ticket 7");
    expect(page.captured.section).toBe(page.resource());
  });

  it.each(["abc", "0", "-3", "1.5", "007x", "99999999999999999999"])("treats the invalid identity %s as not found, without a request", async (raw) => {
    const load = vi.fn(async (id: number) => ticket(id));
    const page = await openAt(`/tickets/${raw}`, load);
    await settle();
    expect(load).not.toHaveBeenCalled();
    expect(page.resource().id.value).toBeNull();
    expect(page.state()).toMatchObject({ status: "failed", reason: "notFound" });
  });

  it("tells a missing record (404) from a failure worth retrying, and a retry recovers", async () => {
    const failures = [new ApiError({ kind: "notFound", message: "no", status: 404 }), new ApiError({ kind: "server", message: "boom", status: 500 }), new ApiError({ kind: "network", message: "offline" })];
    const page = await openAt("/tickets/4", async (id) => {
      const failure = failures.shift();
      if (failure) throw failure;
      return ticket(id);
    });
    await settle();
    expect(page.state()).toMatchObject({ status: "failed", reason: "notFound", error: "The record could not be found." });

    await page.resource().reload();
    expect(page.state()).toMatchObject({ status: "failed", reason: "unavailable", error: "An error occurred while loading data. Please try again." });
    await page.resource().reload();
    expect(page.state()).toMatchObject({ status: "failed", reason: "unavailable", error: "The server could not be reached. Check your connection and try again." });

    await page.resource().reload();
    expect(page.state()).toEqual({ status: "loaded", value: ticket(4) });
  });

  it("clears the previous record when the identity changes, aborts its read and drops a response that arrives late", async () => {
    const reads = new Map<number, ReturnType<typeof deferred<Ticket>>>();
    const signals = new Map<number, AbortSignal>();
    const page = await openAt("/tickets/1", (id, signal) => {
      signals.set(id, signal);
      const read = deferred<Ticket>();
      reads.set(id, read);
      return read.promise;
    });
    reads.get(1)!.resolve(ticket(1));
    await settle();
    expect(page.state()).toMatchObject({ status: "loaded" });

    await page.router.push("/tickets/2");
    expect(page.state()).toEqual({ status: "loading" });
    expect(page.resource().data.value).toBeNull();
    await page.router.push("/tickets/3");
    expect(signals.get(2)?.aborted).toBe(true);
    reads.get(3)!.resolve(ticket(3));
    await settle();
    reads.get(2)!.resolve(ticket(2, "late"));
    await settle();
    expect(page.state()).toEqual({ status: "loaded", value: ticket(3) });
  });

  it("drops a late failure of a read that was left too", async () => {
    const reads = new Map<number, ReturnType<typeof deferred<Ticket>>>();
    const page = await openAt("/tickets/1", (id) => {
      reads.set(id, deferred<Ticket>());
      return reads.get(id)!.promise;
    });
    await page.router.push("/tickets/2");
    reads.get(2)!.resolve(ticket(2));
    await settle();
    reads.get(1)!.reject(new Error("late"));
    await settle();
    expect(page.state()).toEqual({ status: "loaded", value: ticket(2) });
  });

  it("keeps the record on screen while it is read again, and when that read fails", async () => {
    let fail = false;
    const gate = deferred<void>();
    const page = await openAt("/tickets/5", async (id) => {
      if (fail) {
        await gate.promise;
        throw new Error("down");
      }
      return ticket(id);
    });
    await settle();
    fail = true;
    const reload = page.resource().reload();
    expect(page.state()).toEqual({ status: "refreshing", value: ticket(5) });
    gate.resolve();
    await reload;
    expect(page.state()).toMatchObject({ status: "stale", value: ticket(5), error: "An error occurred while loading data. Please try again." });
    expect(page.resource().data.value).toEqual(ticket(5));
  });

  describe("update", () => {
    it("replaces the record with what a save returned, without a request, and drops a read still in flight", async () => {
      const load = vi.fn(async (id: number) => ticket(id));
      const page = await openAt("/tickets/2", load);
      await settle();
      const slow = deferred<Ticket>();
      load.mockImplementationOnce(() => slow.promise);
      const reload = page.resource().reload();

      expect(page.resource().update(ticket(2, "Saved"))).toBe(true);
      slow.resolve(ticket(2, "Older read"));
      await reload;
      expect(page.state()).toEqual({ status: "loaded", value: ticket(2, "Saved") });
      expect(load).toHaveBeenCalledTimes(2);
    });

    it("ignores a save that finished after the user moved to another record, and keeps the read of the new one", async () => {
      const reads = new Map<number, ReturnType<typeof deferred<Ticket>>>();
      const page = await openAt("/tickets/1", (id) => {
        reads.set(id, deferred<Ticket>());
        return reads.get(id)!.promise;
      });
      reads.get(1)!.resolve(ticket(1));
      await settle();
      const saving = page.captured.section!; // a section opened on record 1, saving while the user pages on

      await page.router.push("/tickets/2");
      expect(saving.update(ticket(1, "Saved late"))).toBe(false);
      expect(page.state()).toEqual({ status: "loading" });

      reads.get(2)!.resolve(ticket(2));
      await settle();
      expect(saving.update(ticket(1, "Saved later"))).toBe(false);
      expect(page.state()).toEqual({ status: "loaded", value: ticket(2) });
    });

    it("asks a record without an id which one it is", async () => {
      const Page = defineComponent({
        setup() {
          const resource = useRouteResource<{ title: string }>({ param: "ticketID", load: async () => ({ title: "x" }), identify: (value) => (value.title === "x" ? 3 : -1) });
          return () => h("output", [String(resource.update({ title: "x" })), String(resource.update({ title: "y" }))]);
        },
      });
      const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/t/:ticketID", component: Page }] });
      await router.push("/t/3");
      const view = render(defineComponent({ render: () => h(RouterView) }), { global: { plugins: [router, i18n] } });
      expect(view.container.textContent).toBe("truefalse");
    });
  });

  it("takes other identities through a pluggable parser", async () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    const load = vi.fn(async (id: string) => ({ id, name: "Account" }));
    const Page = defineComponent({
      setup() {
        const resource = useRouteResource({ param: "accountID", parse: (raw) => (uuid.test(raw) ? raw : null), load });
        return () => h("output", resource.state.value.status);
      },
    });
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/a/:accountID", component: Page }] });
    await router.push("/a/3f2c1b9e-0000-4000-8000-000000000001");
    const view = render(defineComponent({ render: () => h(RouterView) }), { global: { plugins: [router, i18n] } });
    await settle();
    expect(load).toHaveBeenCalledWith("3f2c1b9e-0000-4000-8000-000000000001", expect.anything());
    expect(view.container.textContent).toBe("loaded");
    await router.push("/a/12");
    expect(view.container.textContent).toBe("failed");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("issues no request when the route is left, and aborts and drops what is in flight when the page unmounts", async () => {
    const read = deferred<Ticket>();
    const signals: AbortSignal[] = [];
    const load = vi.fn((_id: number, signal: AbortSignal) => {
      signals.push(signal);
      return read.promise;
    });
    const page = await openAt("/tickets/1", load);
    await page.router.push("/elsewhere");
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
    expect(page.container.textContent).toBe("elsewhere");
    page.unmount();
    expect(signals[0]?.aborted).toBe(true);
    read.resolve(ticket(1));
    await settle();
  });

  it("keeps showing its record while it is still mounted after the route left it (a leave transition), not 'not found'", async () => {
    const page = await openAt("/tickets/6", async (id) => ticket(id));
    await settle();
    // The route has moved on but the page has not unmounted yet: its parameter is gone.
    await page.router.push("/elsewhere");
    expect(page.resource().id.value).toBe(6);
    expect(page.state()).toEqual({ status: "loaded", value: ticket(6) });
  });

  it("names the key when a section asks for a resource nobody provided", () => {
    const KEY: InjectionKey<RouteResource<Ticket>> = Symbol("helpdesk.ticket");
    const Orphan = defineComponent({
      setup() {
        useRouteResourceContext(KEY);
        return () => null;
      },
    });
    const error = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => render(Orphan, { global: { plugins: [i18n] } })).toThrow(MissingContextError);
    expect(() => render(Orphan, { global: { plugins: [i18n] } })).toThrow(/helpdesk\.ticket/);
    error.mockRestore();
    expect(() => useRouteResourceContext(KEY)).toThrow(MissingContextError);
  });
});

describe("positiveInteger", () => {
  it("accepts positive safe integers written in digits only", () => {
    expect(positiveInteger("12")).toBe(12);
    for (const bad of ["0", "-1", "1.5", "abc", "", " 1", "1e3", "99999999999999999"]) expect(positiveInteger(bad)).toBeNull();
  });
});

describe("useResource", () => {
  function panel<T>(identity: { value: number | null }, load: (id: number) => Promise<T>) {
    const holder: { resource?: ReturnType<typeof useResource<T>> } = {};
    const Host = defineComponent({
      setup() {
        holder.resource = useResource({ for: () => identity.value, load: (id) => load(id) });
        return () => null;
      },
    });
    render(Host, { global: { plugins: [i18n] } });
    return { resource: holder.resource! };
  }

  it("loads for an identity, follows it, and is independent of any other resource", async () => {
    const identity = ref<number | null>(1);
    const first = panel(identity, async (id) => [`comment of ${id}`]);
    const second = panel(identity, async () => {
      throw new Error("history down");
    });
    await settle();
    expect(first.resource.state.value).toEqual({ status: "loaded", value: ["comment of 1"] });
    expect(second.resource.state.value).toMatchObject({ status: "failed", reason: "unavailable" });

    identity.value = 2;
    expect(first.resource.state.value).toEqual({ status: "loading" });
    await settle();
    expect(first.resource.state.value).toEqual({ status: "loaded", value: ["comment of 2"] });

    identity.value = null;
    await nextTick();
    expect(first.resource.state.value).toMatchObject({ status: "failed", reason: "notFound" });
  });
});
