import { render, screen } from "@testing-library/vue";
import { createTestApp, createTestPlatform, jsonResponse, routedTransport, settle, stubRoutes } from "@wssto2/vue-core/testing";
import { describe, expect, it } from "vitest";
import { createTicketsApi } from "../api";
import { createTicketList } from "../collection";
import { TICKETS } from "../context";
import en from "../i18n/en.json";
import { ticketRoutes } from "../routes";
import Index from "../views/Index.vue";

const ticket = { id: 1, subject: "Printer is on fire", status: "open", assignee: "Ana", created_at: "2026-09-30T08:00:00Z" };

// The page as the application runs it, around a backend answering by route: no mocked modules.
function mountIndex(permissions: string[]) {
  const { transport, calls } = routedTransport({
    "GET /tickets": jsonResponse(200, { success: true, data: [ticket], meta: { total: 1, page: 1, per_page: 25, last_page: 1, from: 1, to: 1 } }),
  });
  const platform = createTestPlatform({ permissions, transport });
  const api = createTicketsApi(platform.http);
  const app = createTestApp({
    platform,
    routes: stubRoutes(ticketRoutes.records), // the real route names, empty pages
    location: "/tickets",
    messages: { en: { tickets: en } },
    plugins: [{ install: (instance) => instance.provide(TICKETS, { api, list: createTicketList(api) }) }],
  });
  render(Index, { global: { plugins: [...app.plugins] } });
  return { calls, router: app.router };
}

describe("the ticket list", () => {
  it("shows what the backend sent, each ticket linking to its record", async () => {
    const { calls } = mountIndex(["tickets:view"]);
    await settle();
    expect(screen.getByRole("link", { name: "Printer is on fire" }).getAttribute("href")).toMatch(/^\/tickets\/1\?from=/); // the link carries the list's state
    expect(calls[0]?.url).toContain("order_col=created_at"); // what the list asked for: its default sort
  });

  it("offers to create a ticket only to whoever may", async () => {
    mountIndex(["tickets:view"]);
    await settle();
    expect(screen.queryByRole("button", { name: "New ticket" })).toBeNull();
  });

  it("offers it to a user holding the permission", async () => {
    mountIndex(["tickets:view", "tickets:update"]);
    await settle();
    expect(screen.getAllByRole("button", { name: "New ticket" }).length).toBeGreaterThan(0);
  });
});
