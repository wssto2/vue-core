import { fireEvent, screen, waitFor } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { callsTo, listOf, stopApplications } from "../identity/testing";
import { dataOf } from "../identity/testing";
import { settle } from "../testing";
import { INCIDENT_CREATE, INCIDENT_VIEW, incident, shown, startIncidents } from "./testing";

vi.setConfig({ testTimeout: 30_000 });
afterEach(stopApplications);

const rows = [
  incident(),
  incident({ id: 13, public_code: "INC-000013", title: "Blank page after sign-in", source: "client_error", severity: "low", status: "resolved", occurrence_count: 3, report_count: 0 }),
];
const open = (permissions: string[], location = "/incidents", extra: Record<string, never | Parameters<typeof startIncidents>[0]["answers"][string]> = {}) =>
  startIncidents({ permissions, location, answers: { "GET /v1/incidents": listOf(rows), ...extra } });

describe("the incidents list", () => {
  it("lists the incidents last seen first, with code, severity, status and source", async () => {
    const { calls, target } = await open([INCIDENT_VIEW]);
    const asked = callsTo(calls, "GET", "/v1/incidents")[0]!.url;
    expect(asked).toContain("order_col=last_seen_at");
    expect(asked).toContain("order_dir=desc");
    const text = target.textContent!;
    for (const expected of ["Invoice export fails", "INC-000012", "High", "New", "Mixed", "Blank page after sign-in", "Low", "Resolved", "Browser error"]) expect(text).toContain(expected);
    expect(screen.getByRole("link", { name: /Invoice export fails/ }).getAttribute("href")).toMatch(/^\/incidents\/12\?from=/);
  });

  it("sends the status, severity, source and date filters to the server and drops any other", async () => {
    const state = Buffer.from(JSON.stringify({ f: { status: "resolved", severity: "low", source: "client_error", nothing: "x" } })).toString("base64url");
    const { calls } = await open([INCIDENT_VIEW], `/incidents?query=${state}`);
    const asked = new URL(callsTo(calls, "GET", "/v1/incidents").at(-1)!.url, "http://test.invalid").searchParams;
    expect([asked.get("status"), asked.get("severity"), asked.get("source")]).toEqual(["resolved", "low", "client_error"]);
    expect(asked.has("nothing")).toBe(false);
  });

  it("has 'Report a bug' for whoever holds incident:create only", async () => {
    await open([INCIDENT_VIEW, INCIDENT_CREATE]);
    expect(screen.getAllByRole("button", { name: "Report a bug" }).length).toBeGreaterThan(0);
  });

  it("has no 'Report a bug' without incident:create", async () => {
    await open([INCIDENT_VIEW]);
    expect(screen.queryByRole("button", { name: "Report a bug" })).toBeNull();
  });

  it("opens the incident a report opened or joined", async () => {
    const { application, calls } = await open([INCIDENT_VIEW, INCIDENT_CREATE], "/incidents", {
      "POST /v1/incidents/reports": dataOf({ data: incident({ id: 40 }), meta: { reports: [], comments: [], watching: true } }),
      "GET /v1/incidents/40": shown(incident({ id: 40 })),
    });
    await fireEvent.click(screen.getAllByRole("button", { name: "Report a bug" })[0]!);
    await settle();
    await fireEvent.update(screen.getByLabelText(/^Title/), "Cannot print");
    await fireEvent.update(screen.getByLabelText(/^Description/), "The button does nothing");
    await fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    await waitFor(() => expect(application.router.currentRoute.value.path).toBe("/incidents/40"));
    expect(callsTo(calls, "POST", "/v1/incidents/reports")).toHaveLength(1);
  });
});
