import { fireEvent, screen, waitFor } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { choose, offered } from "../identity/serviceaccounts/testing";
import { callsTo, dataOf, refusal, stopApplications } from "../identity/testing";
import { settle } from "../testing";
import { INCIDENT_CREATE, INCIDENT_MANAGE, INCIDENT_UPDATE, INCIDENT_VIEW, ana, comment, incident, ivan, shown, startIncidents } from "./testing";

vi.setConfig({ testTimeout: 30_000 });
afterEach(stopApplications);

type Answers = Parameters<typeof startIncidents>[0]["answers"];
const open = (permissions: string[], answers: Answers = {}, who = incident(), extra?: Parameters<typeof shown>[1]) =>
  startIncidents({ permissions, location: "/incidents/12", answers: { "GET /v1/incidents/12": shown(who, extra), ...answers } });
const body = (calls: Parameters<typeof callsTo>[0], method: string, path: string) => JSON.parse(String(callsTo(calls, method, path)[0]!.init.body));

describe("an incident's record", () => {
  it("heads the page with the title, code, severity and status, and tells what happened", async () => {
    const { target } = await open([INCIDENT_VIEW]);
    expect(target.querySelector("h1")?.textContent).toContain("Invoice export fails");
    const text = target.querySelector("[data-test=incident]")!.textContent!;
    for (const expected of ["The export ends in an error page.", "billing", "/v1/invoices/export", "production", "sql.ErrConnDone", "connection is already closed", "main.export()"]) expect(text).toContain(expected);
  });

  it("shows the reports and comments with their people (name and e-mail), and marks the internal comments", async () => {
    const { target } = await open([INCIDENT_VIEW], {}, incident(), { comments: [comment(), comment({ id: 6, visibility: "internal", body: "Staff only note", author: ana })] });
    const reports = target.querySelector("[data-test=incident-report-item]")!.textContent!;
    for (const expected of ["Ana Anić", "ana@example.test", "Export does not work", "I press Export", "Open invoices, press Export"]) expect(reports).toContain(expected);
    const comments = [...target.querySelectorAll("[data-test=incident-comment-item]")];
    expect(comments).toHaveLength(2);
    expect(comments[0]!.textContent).toContain("Ivan Horvat");
    expect(comments[0]!.textContent).not.toContain("Internal");
    expect(comments[1]!.textContent).toContain("Internal (staff only)");
  });

  it("says when there are no reports and no comments", async () => {
    await open([INCIDENT_VIEW], {}, incident(), { reports: [], comments: [] });
    expect(await screen.findByText("No reports linked to this incident yet.")).toBeTruthy();
    expect(screen.getByText("No comments yet.")).toBeTruthy();
  });

  it("summarises the source, counts, reporter and assignee", async () => {
    const { target } = await open([INCIDENT_VIEW]);
    const text = target.textContent!;
    for (const expected of ["Mixed", "14", "Ana Anić", "Ivan Horvat", "ivan@example.test"]) expect(text).toContain(expected);
  });

  it("links the external ticket", async () => {
    await open([INCIDENT_VIEW], {}, incident({ external_ticket_provider: "github", external_ticket_id: "#88", external_ticket_url: "https://example.test/issues/88" }));
    const link = await screen.findByRole("link", { name: "#88" });
    expect(link.getAttribute("href")).toBe("https://example.test/issues/88");
  });

  it("shows no management form without incident:update", async () => {
    const { target } = await open([INCIDENT_VIEW]);
    expect(target.querySelector("[data-test=incident-management]")).toBeNull();
  });
});

describe("managing an incident", () => {
  it("offers the six statuses", async () => {
    await open([INCIDENT_VIEW, INCIDENT_UPDATE]);
    expect(await offered(/^Status/)).toEqual(["New", "Triaged", "In progress", "Resolved", "Ignored", "Duplicate"]);
  });

  it("sends the whole form with the idempotency key; then reads the incident again", async () => {
    const stored = incident({ status: "triaged" });
    const { calls, target } = await open([INCIDENT_VIEW, INCIDENT_UPDATE], { "PATCH /v1/incidents/12": dataOf(stored) });
    expect(target.querySelector("[data-test=incident-management]")).not.toBeNull();
    await choose(/^Status/, "Triaged");
    await fireEvent.update(screen.getByLabelText(/Resolution summary/), "Looking");
    await fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(callsTo(calls, "PATCH", "/v1/incidents/12")).toHaveLength(1));
    expect(body(calls, "PATCH", "/v1/incidents/12")).toEqual({
      status: "triaged",
      severity: "high",
      visibility: "reporter_and_staff",
      assigned_to_user_id: ivan.id,
      duplicate_of_incident_id: null,
      resolution_summary: "Looking",
      external_ticket_provider: "none",
      external_ticket_id: "",
      external_ticket_url: "",
    });
    expect(new Headers(callsTo(calls, "PATCH", "/v1/incidents/12")[0]!.init.headers).get("Idempotency-Key")).toBeTruthy();
    await waitFor(() => expect(callsTo(calls, "GET", "/v1/incidents/12").length).toBeGreaterThanOrEqual(2));
    expect(target.querySelector("[data-test=incident]")!.textContent).toContain("Triaged");
  });

  it("puts a server refusal on its field", async () => {
    await open([INCIDENT_VIEW, INCIDENT_UPDATE], { "PATCH /v1/incidents/12": refusal(422, "validation", { fields: { resolution_summary: "Too long." } }) });
    await fireEvent.update(screen.getByLabelText(/Resolution summary/), "x");
    await fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Too long.")).toBeTruthy();
  });
});

describe("commenting", () => {
  it("asks for a text before any request", async () => {
    const { calls } = await open([INCIDENT_VIEW, INCIDENT_CREATE]);
    await fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    await settle();
    expect(callsTo(calls, "POST", "/v1/incidents/12/comments")).toHaveLength(0);
    expect(screen.getAllByText("Required.").length).toBeGreaterThan(0);
  });

  it("posts a public comment, clears the box and reads the incident again", async () => {
    const { calls } = await open([INCIDENT_VIEW, INCIDENT_CREATE], { "POST /v1/incidents/12/comments": dataOf(comment({ id: 9 })) });
    expect(screen.queryByLabelText("Comment visibility")).toBeNull(); // not the staff
    await fireEvent.update(screen.getByLabelText("Comment"), "Thank you");
    await fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/incidents/12/comments")).toHaveLength(1));
    expect(body(calls, "POST", "/v1/incidents/12/comments")).toEqual({ body: "Thank you", visibility: "public" });
    await waitFor(() => expect(callsTo(calls, "GET", "/v1/incidents/12").length).toBeGreaterThanOrEqual(2));
    expect((screen.getByLabelText("Comment") as HTMLTextAreaElement).value).toBe("");
  });

  it("lets the staff write an internal comment", async () => {
    const { calls } = await open([INCIDENT_VIEW, INCIDENT_CREATE, INCIDENT_MANAGE], { "POST /v1/incidents/12/comments": dataOf(comment({ id: 9, visibility: "internal" })) });
    await fireEvent.update(screen.getByLabelText("Comment"), "Note for us");
    await choose(/Comment visibility/, "Internal (staff only)");
    await fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/incidents/12/comments")).toHaveLength(1));
    expect(body(calls, "POST", "/v1/incidents/12/comments")).toEqual({ body: "Note for us", visibility: "internal" });
  });
});
