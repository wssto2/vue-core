// Fixtures for this folder's tests; the declaration build excludes it.
import { fireEvent, screen, within } from "@testing-library/vue";
import { accessFeature } from "../../access";
import type { ApiKey, ServiceAccount } from "../../modules/serviceaccount/entities";
import { startScreen, type ScreenOptions } from "../testing";
import type { ServiceAccountTenants } from "./context";
import { serviceAccountsFeature } from "./feature";

export const ACCOUNT_VIEW = "iam.serviceaccount:view";
export const ACCOUNT_MANAGE = "iam.serviceaccount:manage";
export const KEY_REVOKE = "iam.serviceaccount:revoke";

export const person = { id: 4, name: "Ivan Horvat" };

export const account = (extra: Partial<ServiceAccount> = {}): ServiceAccount => ({
  id: 21,
  name: "DMS sync",
  description: "Nightly stock sync",
  tenant: { id: 1, name: "Auto Zagreb" },
  owner: person,
  created_by: { id: 1, name: "Ana Anić" },
  created_at: "2026-09-01T08:00:00Z",
  active_keys: 2,
  last_used_at: "2026-10-01T08:30:00Z",
  deactivated_at: null,
  ...extra,
});

export const apiKey = (extra: Partial<ApiKey> = {}): ApiKey => ({
  id: 31,
  name: "Production",
  prefix: "gc_live_a8Zk",
  created_by: { id: 1, name: "Ana Anić" },
  created_at: "2026-09-02T08:00:00Z",
  last_used_at: "2026-10-01T08:30:00Z",
  expires_at: null,
  revoked_at: null,
  ...extra,
});

export const tenants: ServiceAccountTenants = {
  labelKey: "dealer",
  options: async () => [{ id: 1, name: "Auto Zagreb" }, { id: 2, name: "Auto Split" }],
};

/** The service account screens (with the access feature they need) on a fake server; the application's word for a tenant is "Dealer". */
export function startAccounts(options: Omit<ScreenOptions, "features"> & { tenants?: ServiceAccountTenants | false }) {
  const { tenants: offered = tenants, messages, ...rest } = options;
  return startScreen({
    ...rest,
    features: [accessFeature({ catalogue: {} }), serviceAccountsFeature(offered ? { tenants: offered } : {})],
    messages: { en: { dealer: "Dealer" }, ...messages },
  });
}

/** The labels a select called `label` offers (opens its popover; close it with `Escape`). */
export async function offered(label: RegExp | string): Promise<(string | undefined)[]> {
  await fireEvent.click(screen.getByLabelText(label));
  const list = await screen.findByRole("listbox");
  return within(list).getAllByRole("option").map((option) => option.textContent?.trim());
}

/** Picks `option` in the select called `label` (a popover list: open it, press the option's button). */
export async function choose(label: RegExp | string, option: RegExp | string): Promise<void> {
  await fireEvent.click(screen.getByLabelText(label));
  const found = await screen.findByRole("option", { name: option });
  await fireEvent.click((found.querySelector("button") as HTMLElement | null) ?? found);
}
