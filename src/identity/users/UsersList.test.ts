import { fireEvent, screen, waitFor } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../i18n/en.json";
import { settle } from "../../testing";
import { callsTo, dataOf, listOf, startScreen, stopApplications } from "../testing";

// The first screen of a file loads its route chunks through the transformer: slow on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

afterEach(stopApplications);

const person = (id: number, name: string, status = "active", extra: object = {}) => ({
  id, login: name.toLowerCase(), name, email: `${name.toLowerCase()}@example.test`, phone: "", locale: "en", active: status !== "inactive", status,
  last_sign_in: id === 1 ? "2026-10-01T08:30:00Z" : null, locked_until: null, created_at: "2026-09-01T08:00:00Z", ...extra,
});

async function open(permissions: string[], answers: Record<string, never | Parameters<typeof startScreen>[0]["answers"][string]> = {}) {
  const rows = [person(1, "Ana"), person(2, "Ivan", "locked")];
  return startScreen({ permissions, location: "/users", answers: { "GET /v1/iam/users": listOf(rows), ...answers } });
}

describe("the users list", () => {
  it("lists the active people, by name, as go-core's datatable asks", async () => {
    const { calls, target } = await open(["iam.user:view"]);
    const first = callsTo(calls, "GET", "/v1/iam/users")[0]!;
    expect(first.url).toContain("view=active");
    expect(first.url).toContain("order_col=name");
    expect(first.url).toContain("order_dir=asc");
    expect(target.textContent).toContain("Ana");
    expect(target.textContent).toContain("ana@example.test");
    expect(target.textContent).toContain("Never"); // Ivan has not signed in yet
    expect(target.textContent).toContain("Locked");
  });

  it("shows the server's counts on the tabs", async () => {
    const meta = { views: [{ key: "active", count: 12 }, { key: "locked", count: 2 }, { key: "inactive", count: 0 }, { key: "all", count: 14 }] };
    await open(["iam.user:view"], { "GET /v1/iam/users": () => listOf([person(1, "Ana")], { meta }) });
    await waitFor(() => expect(screen.getByRole("tab", { name: /Locked/ }).textContent).toContain("2"));
    expect(screen.getByRole("tab", { name: /Active/ }).textContent).toContain("12");
    expect(screen.getByRole("tab", { name: /All/ }).textContent).toContain("14");
  });

  it("asks again for the view that was chosen", async () => {
    const { calls } = await open(["iam.user:view"]);
    await fireEvent.click(screen.getByRole("tab", { name: "Locked" }));
    await settle();
    expect(callsTo(calls, "GET", "/v1/iam/users").at(-1)!.url).toContain("view=locked");
  });

  it("offers no way to create a person to someone who may only look", async () => {
    await open(["iam.user:view"]);
    expect(screen.queryByRole("button", { name: "New user" })).toBeNull();
  });

  it("is closed to someone without iam.user:view", async () => {
    const { target } = await open([]);
    expect(target.textContent).toContain(en.core.no_access.title);
    expect(target.textContent).not.toContain("ivan@example.test");
  });
});

describe("a new user", () => {
  async function dialog(answers: Parameters<typeof open>[1] = {}) {
    const started = await open(["iam.user:view", "iam.user:manage"], answers);
    await fireEvent.click(screen.getByRole("button", { name: "New user" }));
    await settle();
    return started;
  }
  const fill = async (label: RegExp, value: string) => fireEvent.update(screen.getByLabelText(label), value);

  it("asks for what is missing before the server is asked", async () => {
    const { calls } = await dialog();
    await fireEvent.click(screen.getByRole("button", { name: "Create user" }));
    await settle();
    expect(screen.getAllByText("Required.").length).toBeGreaterThanOrEqual(4);
    expect(callsTo(calls, "POST", "/v1/iam/users")).toHaveLength(0);
  });

  it("catches a password typed twice differently", async () => {
    await dialog();
    await fill(/Full name/, "Eva Marić");
    await fill(/^Username/, "eva");
    await fill(/^E-mail/, "eva@example.test");
    await fill(/^Password/, "long enough password");
    await fill(/Repeat password/, "another one");
    await fireEvent.click(screen.getByRole("button", { name: "Create user" }));
    await settle();
    expect(screen.getByText("The passwords do not match.")).toBeTruthy();
  });

  it("creates the person, without the repetition, and opens their record", async () => {
    const { calls, application } = await dialog({ "POST /v1/iam/users": dataOf(person(3, "Eva")), "GET /v1/iam/users/3": dataOf(person(3, "Eva")), "GET /v1/iam/users/3/sessions": dataOf({ sessions: [] }) });
    await fill(/Full name/, "Eva");
    await fill(/^Username/, "eva");
    await fill(/^E-mail/, "eva@example.test");
    await fill(/^Password/, "long enough password");
    await fill(/Repeat password/, "long enough password");
    await fireEvent.click(screen.getByRole("button", { name: "Create user" }));
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/iam/users")).toHaveLength(1));
    expect(JSON.parse(String(callsTo(calls, "POST", "/v1/iam/users")[0]!.init.body))).toEqual({ login: "eva", name: "Eva", email: "eva@example.test", locale: "en", password: "long enough password" });
    await waitFor(() => expect(application.router.currentRoute.value.name).toBe("users.record.general"));
    expect(application.router.currentRoute.value.params.id).toBe("3");
  });
});
