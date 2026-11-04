// The permission catalogue declared from a generated union (the one-line `extends Record<…, true>` form), checked by
// `npm run typecheck:registry`: the access client, `useAccess`, `AccessGate` props and route `meta.access` all take it.
import type { RouteRecordRaw } from "vue-router";
import { useAccess, usePlatform, type AccessGateProps } from "@wssto2/vue-core/platform";
import { isAllowed } from "@wssto2/vue-core/router";

type Namespace = "crm.lead" | "crm.contract";
type Generated = `${Namespace}:view` | `${Namespace}:manage` | "iam.user:view";

declare module "@wssto2/vue-core/platform" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the declaration is the point
  interface PermissionRegistry extends Record<Generated, true> {}
}

// --- positive: the platform's and the hook's access client take the union; a template literal over a namespace type-checks
const access = useAccess();
access.can("crm.lead:view");
access.canAny(["crm.lead:view", "iam.user:view"]);
export const same: typeof access = usePlatform().access;
export const manage = (namespace: Namespace) => access.can(`${namespace}:manage`);
export const gate: AccessGateProps = { permission: "crm.contract:view" };
export const route: RouteRecordRaw = { path: "/leads", component: {}, meta: { access: { any: ["crm.lead:view", "crm.lead:manage"] } } };
export const allowed = isAllowed("crm.lead:view", access);

// --- negative: a typo is a compile error everywhere
// @ts-expect-error not in the catalogue
access.can("crm.lead:vieww");
// @ts-expect-error not in the catalogue
usePlatform().access.can("crm.lead:delete");
// @ts-expect-error a template literal over a namespace that does not exist
export const bad = (namespace: "crm.lead" | "crm.nothing") => access.can(`${namespace}:view`);
// @ts-expect-error route meta access takes the catalogue
export const typo: RouteRecordRaw = { path: "/x", component: {}, meta: { access: "crm.lead:vieww" } };
// @ts-expect-error route meta access (any) takes the catalogue
export const typoAny: RouteRecordRaw = { path: "/x", component: {}, meta: { access: { all: ["nope"] } } };
// @ts-expect-error the gate takes the catalogue
export const typoGate: AccessGateProps = { permission: "crm.lead:vieww" };
