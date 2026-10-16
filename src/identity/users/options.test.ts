import { fireEvent, screen, waitFor } from "@testing-library/vue";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineFeature } from "../../app";
import { useRouteResourceContext } from "../../resource";
import { usePlatform } from "../../platform";
import { jsonResponse, settle } from "../../testing";
import * as identity from "../index";
import type { UserDetail } from "../../modules/identity/entities";
import { identityRoutes } from "../../modules/identity/routes";
import { callsTo, dataOf, listOf, startScreen, stopApplications } from "../testing";
import { PERSON, usePersonActions } from "./person";
import { useUserDialogs } from "./dialogs";

vi.setConfig({ testTimeout: 30_000 });
afterEach(stopApplications);

const person = (extra: object = {}) => ({
  id: 2, login: "ivan", name: "Ivan Horvat", email: "ivan@example.test", phone: "", locale: "en", active: true, status: "active",
  last_sign_in: null, locked_until: null, created_at: "2026-09-01T08:00:00Z", ext: { dealer: "Zagreb" }, ...extra,
});
const MANAGE = ["iam.user:view", "iam.user:manage", "iam.user.activity:view"];
const record = (extra: object = {}) => ({
  "GET /v1/iam/users": listOf([person()]),
  "GET /v1/iam/users/2": dataOf(person(extra)),
  "GET /v1/iam/users/2/sessions": dataOf({ sessions: [] }),
});

describe("usersFeature({ path })", () => {
  it("serves the list and the record at the application's path, under the same route names", async () => {
    const { application, target } = await startScreen({ permissions: MANAGE, location: "/iam/users", answers: record(), users: { path: "/iam/users/" } });
    expect(target.textContent).toContain("Ivan Horvat");
    expect(application.router.resolve({ name: "users.index" }).path).toBe("/iam/users");
    expect(application.router.resolve({ name: "users.record", params: { id: 2 } }).path).toBe("/iam/users/2");
    expect(application.router.resolve({ name: "users.record.sessions", params: { id: 2 } }).path).toBe("/iam/users/2/sessions");
    expect(target.querySelector('a[href^="/iam/users/2"]')).not.toBeNull();
    await application.router.push("/iam/users/2");
    await waitFor(() => expect(application.router.currentRoute.value.name).toBe("users.record.general"));
  });

  it("defaults to /users", async () => {
    const { application } = await startScreen({ permissions: MANAGE, location: "/", answers: {} });
    expect(application.router.resolve({ name: "users.index" }).path).toBe("/users");
  });
});

describe("usersFeature({ replace })", () => {
  it("swaps the list for the application's, which can open the New user dialog the feature uses", async () => {
    const List = defineComponent({
      setup() {
        const { newUser: NewUser } = useUserDialogs();
        const dialog = ref<identity.NewUserDialogHandle | null>(null);
        return () => h("div", { "data-custom-list": "" }, [h("button", { onClick: () => dialog.value?.create() }, "Add someone"), h(NewUser, { ref: dialog })]);
      },
    });
    const { target } = await startScreen({ permissions: MANAGE, location: "/users", answers: record(), users: { replace: { list: List } } });
    expect(target.querySelector("[data-custom-list]")).not.toBeNull();
    expect(target.textContent).not.toContain("Ivan Horvat");
    await fireEvent.click(screen.getByRole("button", { name: "Add someone" }));
    await settle();
    expect(screen.getByRole("dialog").textContent).toContain("New user");
  });

  it("swaps the details section for the application's, which reads the person with its ext and the actions", async () => {
    const General = defineComponent({
      setup() {
        const person = useRouteResourceContext(PERSON);
        const actions = usePersonActions();
        return () => h("p", { "data-custom-general": "" }, `${(person.data.value?.ext as { dealer: string }).dealer} ${actions.can.manage ? "manage" : "view"}`);
      },
    });
    const { target } = await startScreen({ permissions: MANAGE, location: "/users/2/general", answers: record(), users: { replace: { general: General } } });
    expect(target.querySelector("[data-custom-general]")?.textContent).toBe("Zagreb manage");
    expect(target.querySelector("[data-person-general]")).toBeNull();
    // The other sections stay the library's.
    expect(target.querySelector('a[href="/users/2/signin"]')).not.toBeNull();
  });

  it("swaps the New user dialog: the list opens it with create() and follows its created event", async () => {
    const NewUser = defineComponent({
      emits: ["created"],
      setup(_, { emit, expose }) {
        const { http } = usePlatform();
        const shown = ref(false);
        expose({ create: () => (shown.value = true) });
        const save = async () => emit("created", (await http.request(identityRoutes.usersCreate, { login: "pero", name: "Pero", email: "p@x.test", locale: "en", password: "x", ext: { dealer: 3 } })).data);
        return () => (shown.value ? h("button", { onClick: save }, "Save custom") : null);
      },
    });
    const { calls, application } = await startScreen({
      permissions: MANAGE,
      location: "/users",
      answers: { ...record(), "POST /v1/iam/users": jsonResponse(201, { success: true, data: person({ id: 2 }) }) },
      users: { replace: { newUser: NewUser } },
    });
    await fireEvent.click(screen.getByRole("button", { name: "New user" }));
    await fireEvent.click(await screen.findByRole("button", { name: "Save custom" }));
    await waitFor(() => expect(application.router.currentRoute.value.name).toBe("users.record.general"));
    expect(JSON.parse(String(callsTo(calls, "POST", "/v1/iam/users")[0]!.init.body)).ext).toEqual({ dealer: 3 });
  });

  it("swaps the Deactivate dialog: it gets the person and the session count, sends its details and the record reloads on done", async () => {
    const seen: unknown[] = [];
    const Deactivate = defineComponent({
      props: { id: { type: Number, required: true }, name: { type: String, required: true }, sessionCount: { type: Number, default: null } },
      emits: ["done"],
      setup(props, { emit, expose }) {
        const { http } = usePlatform();
        const shown = ref(false);
        expose({ open: () => (shown.value = true) });
        seen.push(props);
        const run = async () => {
          await http.request(identityRoutes.usersDeactivate, { id: props.id, details: { leads_to: 5 } });
          emit("done");
        };
        return () => (shown.value ? h("button", { onClick: run }, `Hand over ${props.name}`) : null);
      },
    });
    const { calls } = await startScreen({
      permissions: MANAGE,
      location: "/users/2/general",
      answers: { ...record(), "POST /v1/iam/users/2/deactivate": dataOf({ ext: { moved: 3 } }) },
      users: { replace: { deactivate: Deactivate } },
    });
    await fireEvent.click(document.querySelector("[data-deactivate-row] button") as HTMLElement);
    await fireEvent.click(await screen.findByRole("button", { name: "Hand over Ivan Horvat" }));
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/iam/users/2/deactivate")).toHaveLength(1));
    expect(JSON.parse(String(callsTo(calls, "POST", "/v1/iam/users/2/deactivate")[0]!.init.body))).toEqual({ details: { leads_to: 5 } });
    await waitFor(() => expect(callsTo(calls, "GET", "/v1/iam/users/2").length).toBeGreaterThan(1));
    expect(seen[0]).toMatchObject({ id: 2, name: "Ivan Horvat" });
  });
});

describe("usersFeature({ activityRecords, changeWords })", () => {
  const customerPage = defineFeature({ id: "customers", routes: [{ name: "customer", path: "/customers/:id", component: { render: () => null } }] });

  it("names and links the records the application knows, and leaves the others as the server wrote them", async () => {
    const rows = [
      { id: 2, area: "crm", record_type: "customers", record_id: 7, action: "changed", signed_in_as: null, created_at: "2026-10-02T09:15:00Z" },
      { id: 1, area: "crm", record_type: "invoices", record_id: 9, action: "created", signed_in_as: null, created_at: "2026-10-02T08:00:00Z" },
    ];
    const { target } = await startScreen({
      permissions: MANAGE,
      location: "/users/2/activity",
      answers: { ...record(), "GET /v1/iam/users/2/activity": listOf(rows, { meta: { views: [{ key: "all", count: 2 }] } }) },
      features: [customerPage],
      messages: { en: { records: { customer: "Customer" } } },
      users: { activityRecords: { customers: { labelKey: "records.customer", to: (id) => ({ name: "customer", params: { id } }) } } },
    });
    const link = await waitFor(() => target.querySelector("[data-activity-link]") as HTMLAnchorElement);
    expect(link.textContent).toBe("Customer #7");
    expect(link.getAttribute("href")).toBe("/customers/7");
    const text = [...target.querySelectorAll("[data-activity-row]")].map((row) => row.textContent);
    expect(text[1]).toContain("invoices #9");
    expect(target.querySelectorAll("[data-activity-link]")).toHaveLength(1);
  });

  it("words the changes the library has no sentence for, with a link, and keeps its own wording for the rest", async () => {
    const rows = [
      { id: 2, action: "role_granted", fields: [], before: {}, after: {}, actor: { id: 1, name: "Ana Anić" }, created_at: "2026-10-02T09:15:00Z", ext: { role: "Seller", binding: 11 } },
      { id: 1, action: "password", fields: [], before: {}, after: {}, actor: null, created_at: "2026-10-01T08:00:00Z" },
    ];
    const asked: string[] = [];
    const { target } = await startScreen({
      permissions: MANAGE,
      location: "/users/2/changes",
      answers: { ...record(), "GET /v1/iam/users/2/changes": listOf(rows) },
      features: [customerPage],
      users: {
        changeWords: (row, t) => {
          asked.push(row.action);
          const ext = row.ext as { role: string; binding: number } | undefined;
          return row.action === "role_granted" && ext ? { sentence: t("granted", { role: ext.role }), details: ["Zagreb", { text: "Binding", to: { name: "customer", params: { id: ext.binding } } }] } : undefined;
        },
      },
      messages: { en: { granted: "Role {role} granted" } },
    });
    const lines = await waitFor(() => {
      const found = [...target.querySelectorAll("[data-change-row]")];
      expect(found).toHaveLength(2);
      return found;
    });
    expect(lines[0]!.textContent).toContain("Role Seller granted");
    expect(lines[0]!.textContent).toContain("Zagreb");
    expect(lines[0]!.querySelector("[data-change-link]")?.getAttribute("href")).toBe("/customers/11");
    expect(lines[1]!.textContent).toContain("Password changed");
    expect(asked).toContain("password");
  });
});

describe("the pieces a replaced screen reuses", () => {
  it("are exported from the identity entry", () => {
    for (const name of ["PageBar", "SectionIntro", "SessionList", "SignInList", "SignInTable", "ChangeFeed", "NewUserDialog", "DeactivateDialog", "ActionRow"] as const) expect(identity[name]).toBeTruthy();
    for (const name of ["PERSON", "usePersonActions", "useUsersContext", "useUserDialogs", "userList", "identityRoutes"] as const) expect(identity[name]).toBeTruthy();
  });

  it("type the ext as unknown for the application to narrow", () => {
    const user = { ...person(), ext: { dealer: "Zagreb" } } as UserDetail;
    expect((user.ext as { dealer: string }).dealer).toBe("Zagreb");
  });
});
