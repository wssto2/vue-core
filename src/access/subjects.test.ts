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

const root: Scope = { level: "organization", id: null, name: null };
const sellerRow = summary({ ref: "seller", key: "seller", name: "Seller", predefined: true });
const binding = (id: number): Binding => ({ id, role: sellerRow, scope: root, created_by: null, created_at: "2026-10-01T10:00:00Z" });
const access = (bindings: Binding[]): SubjectAccess => ({ subject: { kind: "service", id: 9 }, bindings, effective: [], can_manage: true });

const page = defineComponent({ render: () => h(PersonAccess, { subject: { kind: "service", id: 9 }, name: "Importer" }) });
const feature = defineFeature({ id: "service", routes: [{ name: "service", path: "/services/9", component: page }] });
let running: Started | null = null;

describe("access for a service account", () => {
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
      [accessPermissions.viewAccess, accessPermissions.manageServiceBindings],
      "/services/9",
      {},
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

  it("sends a person to go-core's user routes and a service account to its own", async () => {
    const { transport, calls } = routedTransport({
      "GET /v1/iam/users/4/access": data(access([])),
      "GET /v1/iam/service-accounts/9/scopes": data({ root_level: "organization", root: true, places: [] }),
      "GET /v1/iam/service-accounts/bindable-roles": data({ roles: [seller] }),
    });
    const api = createAccessApi(createHttpClient({ baseUrl: "", transport }));
    await api.access({ kind: "user", id: 4 });
    await api.scopes({ kind: "service", id: 9 });
    await api.bindable({ kind: "service", id: 9 }, "organization", null);
    expect(calls.map((call) => call.url)).toEqual(["/v1/iam/users/4/access", "/v1/iam/service-accounts/9/scopes", "/v1/iam/service-accounts/bindable-roles?level=organization&scope_id=0"]);
  });

  it("offers adding and removing roles to whoever manages service accounts, not to whoever only manages people", async () => {
    const answers = { "GET /v1/iam/service-accounts/9/access": data(access([binding(5)])) };
    running = await startAccess(answers, [accessPermissions.viewAccess, accessPermissions.manageBindings], "/services/9", {}, [feature]);
    await screen.findByText("Seller");
    expect(queryTest("add-role")).toBeNull();
    expect(queryTest("remove-binding-5")).toBeNull();
    running.dispose();
    running = await startAccess(answers, [accessPermissions.viewAccess, accessPermissions.manageServiceBindings], "/services/9", {}, [feature]);
    await findTest("add-role");
    expect(queryTest("remove-binding-5")).not.toBeNull();
  });
});
