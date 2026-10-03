// Fixtures for this folder's tests; the declaration build excludes it.
import { createMemoryHistory } from "vue-router";
import { createApplication, defineFeature, type Application } from "../app";
import { page } from "../app/testing";
import type { Role, RoleSummary } from "../modules/access/entities";
import { backofficeShell } from "../shell";
import { createTestPlatform, jsonResponse, routedTransport, type Answer } from "../testing";
import type { PermissionCatalogue, PermissionMeta } from "./catalogue";
import { accessFeature, type AccessFeatureOptions } from "./feature";

const meta = (id: string, extra: Partial<PermissionMeta> = {}): [string, PermissionMeta] => {
  const [namespace = "", verb = ""] = id.split(":");
  const [module = "", ...rest] = namespace.split(".");
  return [id, { module, resource: rest.join("."), verb, labelKey: "", descriptionKey: "", sensitive: false, system: false, organizationOnly: false, ownable: null, unownedIsOwn: false, feature: null, attributes: [], requires: [], ...extra }];
};

/** A small catalogue: customers (ownable, view < update), leads, and a sensitive system permission. */
export const catalogue: PermissionCatalogue = Object.fromEntries([
  meta("crm.customer:view", { ownable: "crm.customer", labelKey: "perm.customer.view" }),
  meta("crm.customer:update", { ownable: "crm.customer", requires: ["crm.customer:view"], labelKey: "perm.customer.update" }),
  meta("crm.lead:view", { labelKey: "perm.lead.view" }),
  meta("iam.role:manage", { system: true, sensitive: true, labelKey: "perm.role.manage" }),
]);

export const summary = (extra: Partial<RoleSummary> & { name: string; ref: string }): RoleSummary => ({
  id: null, key: null, description: "", predefined: false, computed: false, attrs: [], holders: 0, permission_count: 0, ...extra,
});

export const role = (extra: Partial<Role> & { name: string; ref: string }): Role => ({ ...summary(extra), grants: [], ...extra });

export const seller = role({ ref: "seller", key: "seller", name: "Seller", predefined: true, permission_count: 1, grants: [{ permission: "crm.lead:view", qualifier: "all" }] });
export const support = role({ ref: "7", id: 7, name: "Support", description: "Answers customers", holders: 2, permission_count: 2, grants: [{ permission: "crm.customer:view", qualifier: "own" }, { permission: "crm.customer:update", qualifier: "own" }] });

export const data = (value: unknown) => jsonResponse(200, { success: true, data: value });
export const refusal = (status: number, code: string) => jsonResponse(status, { success: false, error: "refused", code });

export interface Started {
  readonly application: Application;
  readonly target: HTMLElement;
  readonly calls: ReturnType<typeof routedTransport>["calls"];
  readonly dispose: () => void;
}

/** The access feature in an application whose server answers `answers`, signed in with `permissions`, at `location`. */
export async function startAccess(answers: Record<string, Answer>, permissions: readonly string[], location: string, options: Partial<AccessFeatureOptions> = {}): Promise<Started> {
  const { transport, calls } = routedTransport(answers);
  const platform = createTestPlatform({ permissions, transport });
  const history = createMemoryHistory();
  history.replace(location);
  const application = createApplication({
    platform,
    shell: backofficeShell(),
    features: [defineFeature({ id: "sign-in", routes: [{ name: "login", path: "/login", component: page("sign in"), meta: { public: true } }, { name: "home", path: "/", component: page("home") }] }), accessFeature({ catalogue, ...options })],
    router: { history },
    // The application's own texts: what a catalogue's keys, a custom role's kind and a level mean.
    i18n: { missingWarn: false, messages: { en: { perm: { customer: { view: "View customers", update: "Edit customers" }, lead: { view: "View leads" }, role: { manage: "Manage roles" } }, access: { modules: { crm: "CRM", iam: "Administration" }, resources: { crm_customer: "Customers", crm_lead: "Leads" } } } } },
  });
  const target = document.createElement("div");
  document.body.append(target);
  await application.mount(target);
  return { application, target, calls, dispose: () => { application.dispose(); target.remove(); } };
}

const until = async <T>(read: () => T | null | undefined, what: string): Promise<T> => {
  for (let attempt = 0; attempt < 200; attempt++) {
    const found = read();
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Never saw ${what}`);
};

/** The element marked `data-test`, once it is on screen. */
export const findTest = (name: string): Promise<HTMLElement> => until(() => document.querySelector<HTMLElement>(`[data-test="${name}"]`), `an element marked ${name}`);
export const queryTest = (name: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-test="${name}"]`);
export const queryAllTest = (name: string): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(`[data-test="${name}"]`)];

/** Opens the select whose label is `label` and picks `option`. */
export async function choose(label: string, option: string): Promise<void> {
  const named = [...document.querySelectorAll("label")].find((element) => element.textContent?.trim().startsWith(label));
  const trigger = (named?.htmlFor ? document.getElementById(named.htmlFor) : null) ?? document.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (!trigger) throw new Error(`No control labelled ${label}`);
  trigger.click();
  const row = await until(() => [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((element) => element.textContent?.trim() === option), `the option ${option}`);
  (row.querySelector("button") ?? row).click();
}
