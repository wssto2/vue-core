import { fireEvent, screen, waitFor, within } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { defineFeature } from "../app";
import { createHttpClient } from "../client";
import type { Binding, Scope, SubjectAccess } from "../modules/access/entities";
import { routedTransport } from "../testing";
import { createAccessApi } from "./api";
import { accessPermissions } from "./context";
import PersonAccess from "./PersonAccess.vue";
import { data, findTest, queryTest, seller, startAccess, summary, type Started } from "./testing";

afterEach(() => {
  running?.dispose();
  running = null;
  document.body.innerHTML = "";
});

const subjects = { service: { base: "/v1/iam/service-accounts", bindable: "/v1/iam/service-accounts/bindable-roles" } };
const root: Scope = { level: "organization", id: null, name: null };
const sellerRow = summary({ ref: "seller", key: "seller", name: "Seller", predefined: true });
const binding = (id: number): Binding => ({ id, role: sellerRow, scope: root, created_by: null, created_at: "2026-10-01T10:00:00Z" });
const access = (bindings: Binding[]): SubjectAccess => ({ subject: { kind: "service", id: 9 }, bindings, effective: [], can_manage: true });

const page = defineComponent({ render: () => h(PersonAccess, { subject: { kind: "service", id: 9 }, name: "Importer" }) });
const feature = defineFeature({ id: "service", routes: [{ name: "service", path: "/services/9", component: page }] });
let running: Started | null = null;

describe("access for a service subject", () => {
  it("reads, binds and unbinds at the application's routes, and asks that kind's bindable roles", async () => {
    let body: unknown = null;
    let reads = 0;
    running = await startAccess(
      {
        "GET /v1/iam/service-accounts/9/access": () => data(access(reads++ === 0 ? [binding(5)] : [])),
        "GET /v1/iam/service-accounts/9/scopes": data({ root_level: "organization", root: true, places: [] }),
        "GET /v1/iam/service-accounts/bindable-roles": data({ roles: [seller] }),
        "POST /v1/iam/service-accounts/9/bindings": (call: { init: RequestInit }) => ((body = JSON.parse(String(call.init.body))), data(binding(6))),
        "DELETE /v1/iam/service-accounts/9/bindings/5": new Response(null, { status: 204 }),
      },
      [accessPermissions.viewAccess, accessPermissions.manageBindings],
      "/services/9",
      { subjects },
      [feature],
    );
    const { calls } = running;
    await screen.findByText("Seller");
    await fireEvent.click(within(queryTest("add-role") as HTMLElement).getByRole("button", { name: "Add role" }));
    await findTest("bindable-roles");
    expect(calls.some((call) => call.url.startsWith("/v1/iam/service-accounts/bindable-roles?level=organization"))).toBe(true);
    await fireEvent.click(screen.getByRole("option", { name: /Seller/ }).querySelector("button") as HTMLElement);
    await fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(body).toEqual({ role_ref: "seller", level: "organization", scope_id: null }));
    await fireEvent.click(within(await findTest("remove-binding-5")).getByRole("button", { name: "Remove" }));
    await fireEvent.click((await screen.findAllByRole("button", { name: "Remove" })).at(-1) as HTMLElement);
    await waitFor(() => expect(calls.some((call) => call.method === "DELETE" && call.url === "/v1/iam/service-accounts/9/bindings/5")).toBe(true));
    expect(calls.some((call) => call.url.startsWith("/v1/iam/users/"))).toBe(false);
  });

  it("refuses a kind the application gave no routes for, never calling the user routes", async () => {
    const { transport, calls } = routedTransport({});
    const api = createAccessApi(createHttpClient({ baseUrl: "", transport }));
    await expect(api.access({ kind: "service", id: 9 })).rejects.toThrow(/no routes for service subjects/);
    await expect(api.bindable({ kind: "service", id: 9 }, "organization", null)).rejects.toThrow(/no routes/);
    expect(calls).toEqual([]);
  });
});
