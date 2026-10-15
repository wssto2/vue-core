import { fireEvent, screen, waitFor } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { callsTo, dataOf, refusal, stopApplications } from "../identity/testing";
import { settle } from "../testing";
import { INCIDENT_CREATE, INCIDENT_MANAGE, INCIDENT_VIEW, incident, startIncidents } from "./testing";

vi.setConfig({ testTimeout: 30_000 });
afterEach(stopApplications);

const created = dataOf({ data: incident({ id: 40 }), meta: { reports: [], comments: [], watching: true } });
type Options = { permissions?: string[]; answers?: Parameters<typeof startIncidents>[0]["answers"]; appVersion?: string };

// The report from the account menu, on the home page: the host shows it.
async function openReport({ permissions = [INCIDENT_CREATE], answers = {}, appVersion }: Options = {}) {
  const started = await startIncidents({ permissions, location: "/", answers: { "POST /v1/incidents/reports": created, ...answers }, feature: { appVersion } });
  await fireEvent.click(screen.getByRole("button", { name: /account|menu|Ana/i }));
  await fireEvent.click(await screen.findByText("Report a bug"));
  await screen.findByLabelText(/^Title/);
  return started;
}
const body = (calls: Parameters<typeof callsTo>[0]) => JSON.parse(String(callsTo(calls, "POST", "/v1/incidents/reports")[0]!.init.body));
const submit = async () => {
  await fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
  await settle();
};

describe("the report dialog", () => {
  it("asks for a title and a description before any request", async () => {
    const { calls } = await openReport();
    await submit();
    expect(screen.getAllByText("Required.").length).toBeGreaterThanOrEqual(2);
    expect(callsTo(calls, "POST", "/v1/incidents/reports")).toHaveLength(0);
  });

  it("sends the page, the browser, the version and a medium severity with the person's words, and the attempt's idempotency key", async () => {
    const { calls } = await openReport({ appVersion: "2.4.1" });
    await fireEvent.update(screen.getByLabelText(/^Title/), "Cannot print");
    await fireEvent.update(screen.getByLabelText(/^Description/), "The button does nothing");
    await submit();
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/incidents/reports")).toHaveLength(1));
    expect(body(calls)).toMatchObject({ title: "Cannot print", description: "The button does nothing", severity: "medium", page_url: "/", browser_info: navigator.userAgent, app_version: "2.4.1", affected_module: "", steps_to_reproduce: "" });
    expect(new Headers(callsTo(calls, "POST", "/v1/incidents/reports")[0]!.init.headers).get("Idempotency-Key")).toBeTruthy();
  });

  it("thanks the person, closes, and stays on the page it was made on", async () => {
    const { application } = await openReport();
    await fireEvent.update(screen.getByLabelText(/^Title/), "Cannot print");
    await fireEvent.update(screen.getByLabelText(/^Description/), "The button does nothing");
    await submit();
    expect(await screen.findByText("Thank you, your report has been submitted.")).toBeTruthy();
    await waitFor(() => expect(screen.queryByLabelText(/^Title/)).toBeNull());
    expect(application.router.currentRoute.value.path).toBe("/");
  });

  it("hides the advanced fields from a person", async () => {
    await openReport();
    expect(screen.queryByLabelText(/Steps to reproduce/)).toBeNull();
    expect(screen.queryByLabelText(/Affected module/)).toBeNull();
  });

  it("shows the staff the advanced fields, and sends them", async () => {
    const { calls } = await openReport({ permissions: [INCIDENT_CREATE, INCIDENT_MANAGE, INCIDENT_VIEW] });
    await fireEvent.update(screen.getByLabelText(/^Title/), "Wrong total");
    await fireEvent.update(screen.getByLabelText(/^Description/), "The total is off");
    await fireEvent.update(screen.getByLabelText(/Affected module/), "billing");
    await fireEvent.update(screen.getByLabelText(/Steps to reproduce/), "Open an invoice");
    await submit();
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/incidents/reports")).toHaveLength(1));
    expect(body(calls)).toMatchObject({ affected_module: "billing", steps_to_reproduce: "Open an invoice" });
  });

  it("keeps the words on a refusal and puts the message on its field", async () => {
    await openReport({ answers: { "POST /v1/incidents/reports": refusal(422, "validation", { fields: { title: "Too long." } }) } });
    await fireEvent.update(screen.getByLabelText(/^Title/), "T");
    await fireEvent.update(screen.getByLabelText(/^Description/), "D");
    await submit();
    expect(await screen.findByText("Too long.")).toBeTruthy();
    expect((screen.getByLabelText(/^Description/) as HTMLTextAreaElement).value).toBe("D");
  });
});
