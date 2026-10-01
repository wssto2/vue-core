import { fireEvent, render, screen } from "@testing-library/vue";
import { createTestApp, createTestPlatform, mockMedia } from "@wssto2/vue-core/testing";
import { afterEach, describe, expect, it } from "vitest";
import en from "../i18n/en.json";
import TicketHistory from "../components/TicketHistory.vue";

interface Event {
  id: number;
  at: string;
  kind: "comment" | "change";
  author: string;
  note: string;
}

const events: Event[] = [
  { id: 1, at: "2026-09-30T08:00:00Z", kind: "comment", author: "Ana", note: "Called the customer" },
  { id: 2, at: "2026-09-30T09:30:00Z", kind: "change", author: "Ivo", note: "Closed" },
];

// One environment per test: the platform decides what the user may do, the messages are the feature's own.
const mountHistory = (permissions: string[], rows: Event[] = events) => {
  const app = createTestApp({ platform: createTestPlatform({ permissions }), messages: { en: { tickets: en } } });
  return render(TicketHistory, { props: { events: rows }, global: { plugins: [...app.plugins] } });
};

describe("the ticket history", () => {
  let media: ReturnType<typeof mockMedia> | undefined;
  afterEach(() => media?.restore());

  it("lists the events in the order given, with the kind as a badge", () => {
    mountHistory([]);
    expect(screen.getAllByRole("row").slice(1).map((row) => row.textContent)).toEqual([
      expect.stringContaining("Called the customer"),
      expect.stringContaining("Closed"),
    ]);
    expect(screen.getByText("Status change")).toBeTruthy();
  });

  it("removes only for whoever may update tickets", () => {
    const { unmount } = mountHistory([]);
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    unmount();
    mountHistory(["tickets:update"]);
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(2);
  });

  it("says so when there is nothing yet", () => {
    mountHistory([], []);
    expect(screen.getByText("Nothing has happened yet.")).toBeTruthy();
  });

  it("becomes phone rows below 1024 px, where a long press or a right click lists the row's actions", async () => {
    media = mockMedia({ narrow: true });
    mountHistory(["tickets:update"]);
    expect(screen.queryByRole("table")).toBeNull();
    await fireEvent.contextMenu(screen.getByText("Closed"));
    expect(await screen.findByRole("menuitem", { name: "Remove" })).toBeTruthy();
  });
});
