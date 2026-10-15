import { fireEvent, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { listOf, startScreen, stopApplications } from "../identity/testing";
import { settle } from "../testing";
import { incidentsFeature } from "./feature";
import { INCIDENT_CREATE, INCIDENT_VIEW, incident, startIncidents } from "./testing";

vi.setConfig({ testTimeout: 30_000 });
afterEach(stopApplications);

const answers = { "GET /v1/incidents": listOf([incident()]) };
const nav = [{ i18n: "nav.incidents", route: "incidents", permissions: [INCIDENT_VIEW] }];

describe("incidentsFeature", () => {
  it("installs the list and the record under their fixed names and paths", async () => {
    const { application } = await startIncidents({ permissions: [INCIDENT_VIEW], location: "/", answers });
    expect(application.router.hasRoute("incidents.index")).toBe(true);
    expect(application.router.hasRoute("incidents.details")).toBe(true);
    expect(application.router.resolve({ name: "incidents.details", params: { incidentID: 12 } }).path).toBe("/incidents/12");
    expect(application.router.resolve({ name: "incidents.index" }).path).toBe("/incidents");
  });

  it("links the destination to the list and keeps it highlighted on an incident", async () => {
    await startScreen({
      permissions: [INCIDENT_VIEW],
      location: "/incidents/12",
      answers: { "GET /v1/incidents/12": (await import("./testing")).shown() },
      navigation: nav,
      messages: { en: { nav: { incidents: "Incidents" } } },
      features: [incidentsFeature({ destination: "incidents" })],
    });
    const links = screen.getAllByRole("link", { name: "Incidents" });
    expect(links[0]!.getAttribute("href")).toBe("/incidents");
    expect(links.some((link) => link.getAttribute("aria-current") !== null)).toBe(true);
  });

  it("keeps a person without incident:view off the list", async () => {
    const { calls } = await startIncidents({ permissions: [], location: "/incidents", answers });
    expect(await screen.findByText("No access")).toBeTruthy();
    expect(screen.queryByText("Invoice export fails")).toBeNull();
    expect(calls.filter((call) => call.url.includes("/v1/incidents"))).toHaveLength(0);
  });

  it("puts 'Report a bug' in the account menu for whoever holds incident:create, and opens the report from any page", async () => {
    await startIncidents({ permissions: [INCIDENT_CREATE], location: "/", answers });
    await fireEvent.click(screen.getByRole("button", { name: /account|menu|Ana/i }));
    const row = await screen.findByText("Report a bug");
    await fireEvent.click(row);
    await settle();
    expect(await screen.findByLabelText(/^Title/)).toBeTruthy();
  });

  it("has no row in the account menu without incident:create", async () => {
    await startIncidents({ permissions: [INCIDENT_VIEW], location: "/", answers });
    await fireEvent.click(screen.getByRole("button", { name: /account|menu|Ana/i }));
    await settle();
    expect(screen.queryByText("Report a bug")).toBeNull();
  });
});
