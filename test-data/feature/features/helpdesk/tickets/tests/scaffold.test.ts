import { describe, expect, it } from "vitest";
import { ticketsApi, ticketList } from "..";

describe("ticketsApi scaffold", () => {
  it("defines the list over the generated route table", () => {
    const http = {} as Parameters<typeof ticketsApi>[0];
    expect(ticketList(ticketsApi(http)).id).toBe("helpdesk.tickets");
  });
});
