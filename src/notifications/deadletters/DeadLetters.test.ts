import { fireEvent, screen, waitFor } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../i18n/en.json";
import { callsTo, dataOf, listOf, refusal, startScreen, stopApplications } from "../../identity/testing";
import { toast } from "../../overlay";
import { settle } from "../../testing";
import { notificationsFeature } from "../feature";
import { connection } from "../testing";

// The first screen of a file loads its route chunks through the transformer: slow on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => connection().response)); // the bell's stream
});
afterEach(() => {
  stopApplications();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const letter = (id: number, extra: object = {}) => ({
  event_id: id, consumer: "notifications.ticket-assigned", event_name: "tickets.Assigned", event_created_at: "2026-10-02T08:00:00Z", attempts: 5, last_error: "the directory was away", dead_at: "2026-10-02T09:00:00Z", retryable: true, ...extra,
});

async function open(permissions: string[], answers: Record<string, Parameters<typeof startScreen>[0]["answers"][string]> = {}) {
  return startScreen({
    permissions,
    location: "/events/dead-letters",
    features: [notificationsFeature()],
    answers: { "GET /v1/events/dead-letters": listOf([letter(7), letter(8, { consumer: "mail.sender", event_name: "", event_created_at: null, retryable: false })]), ...answers },
  });
}
const VIEW = "events.deadletter:view";
/** Opens the actions menu of the first letter (7). */
const openActions = async () => fireEvent.click(await screen.findByRole("button", { name: "More actions: tickets.Assigned" }));
const RETRY = "events.deadletter:retry";

describe("the dead-letters page", () => {
  it("lists what failed: the event, who gave up, how often and why", async () => {
    const { calls, target } = await open([VIEW]);
    const first = callsTo(calls, "GET", "/v1/events/dead-letters")[0]!;
    expect(first.url).toContain("page=1");
    expect(first.url).toContain("per_page=25");
    expect(first.url).not.toContain("consumer=");
    expect(target.textContent).toContain("tickets.Assigned");
    expect(target.textContent).toContain("Event #7");
    expect(target.textContent).toContain("notifications.ticket-assigned");
    expect(target.textContent).toContain("the directory was away");
    expect(target.textContent).toContain("The event no longer exists"); // letter 8's event was pruned
  });

  it("is closed to someone without events.deadletter:view", async () => {
    const { target } = await open([]);
    expect(target.textContent).toContain(en.core.no_access.title);
    expect(target.textContent).not.toContain("the directory was away");
  });

  it("asks only for the consumer typed into the filter", async () => {
    const { calls } = await open([VIEW]);
    await fireEvent.click(screen.getByRole("button", { name: /Consumer/ }));
    const field = await screen.findByRole("textbox");
    await fireEvent.update(field, "mail.sender");
    await fireEvent.submit(field.closest("form")!);
    await waitFor(() => expect(callsTo(calls, "GET", "/v1/events/dead-letters").at(-1)!.url).toContain("consumer=mail.sender"));
  });

  it("has no search field, the server only filters by consumer", async () => {
    await open([VIEW]);
    expect(document.querySelector('input[name="collection-search"]')).toBeNull();
  });

  it("offers no retry to someone who may only look", async () => {
    await open([VIEW]);
    expect(screen.queryByRole("button", { name: /^More actions/ })).toBeNull();
  });
});

describe("retrying", () => {
  it("puts one back in the queue and loads the list again", async () => {
    const success = vi.spyOn(toast, "success").mockReturnValue(1);
    const { calls } = await open([VIEW, RETRY], { "POST /v1/events/dead-letters/7/notifications.ticket-assigned/retry": dataOf({ retried: 1 }) });
    const lists = callsTo(calls, "GET", "/v1/events/dead-letters").length;
    await openActions();
    await fireEvent.click(await screen.findByRole("menuitem", { name: "Retry" }));
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/events/dead-letters/7/notifications.ticket-assigned/retry")).toHaveLength(1));
    await waitFor(() => expect(callsTo(calls, "GET", "/v1/events/dead-letters").length).toBeGreaterThan(lists));
    expect(success).toHaveBeenCalledWith("The event is back in the queue and will be handled again shortly.");
  });

  it("offers no retry for an event that was removed", async () => {
    await open([VIEW, RETRY]);
    await screen.findByRole("button", { name: "More actions: tickets.Assigned" });
    expect(screen.getAllByRole("button", { name: /^More actions/ })).toHaveLength(1); // letter 7 only
  });

  it("says in words that a letter was already retried", async () => {
    const error = vi.spyOn(toast, "error").mockReturnValue(1);
    await open([VIEW, RETRY], { "POST /v1/events/dead-letters/7/notifications.ticket-assigned/retry": refusal(404, "not_found") });
    await openActions();
    await fireEvent.click(await screen.findByRole("menuitem", { name: "Retry" }));
    await waitFor(() => expect(error).toHaveBeenCalledWith("This event was already put back in the queue or no longer exists."));
  });

  it("asks before retrying everything of a consumer, then does it", async () => {
    const success = vi.spyOn(toast, "success").mockReturnValue(1);
    const { calls } = await open([VIEW, RETRY], { "POST /v1/events/dead-letters/retry": dataOf({ retried: 3 }) });
    await openActions();
    await fireEvent.click(await screen.findByRole("menuitem", { name: "Retry all for this consumer" }));
    await settle();
    expect(screen.getByText(/Every failed event of “notifications.ticket-assigned”/)).toBeTruthy();
    expect(callsTo(calls, "POST", "/v1/events/dead-letters/retry")).toHaveLength(0);

    await fireEvent.click(screen.getByRole("button", { name: "Retry all" }));
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/events/dead-letters/retry")).toHaveLength(1));
    expect(JSON.parse(String(callsTo(calls, "POST", "/v1/events/dead-letters/retry")[0]!.init.body))).toEqual({ consumer: "notifications.ticket-assigned" });
    await waitFor(() => expect(success).toHaveBeenCalledWith("Events put back in the queue: 3"));
  });

  it("sends nothing when the question is cancelled", async () => {
    const { calls } = await open([VIEW, RETRY]);
    await openActions();
    await fireEvent.click(await screen.findByRole("menuitem", { name: "Retry all for this consumer" }));
    await settle();
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await settle();
    expect(callsTo(calls, "POST", "/v1/events/dead-letters/retry")).toHaveLength(0);
  });
});
