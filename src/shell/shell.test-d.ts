// Type fixtures, checked by `npm run typecheck` (vue-tsc): positive cases must compile, every
// `@ts-expect-error` line must fail to. Nothing here runs.
import { h } from "vue";
import type { SessionUser } from "../platform";
import AccountMenuItem from "./AccountMenuItem.vue";
import HeaderAction from "./HeaderAction.vue";
import { backofficeShell } from "./backofficeShell";

interface Employee extends SessionUser {
  readonly name: string;
  readonly email: string;
}

// --- positive: the identity is typed with the application's own user, the rest is optional
export const plain = backofficeShell();
export const typed = backofficeShell({ identity: (user: Employee) => ({ name: user.name, detail: user.email }) });

// @ts-expect-error the identity must say a name
backofficeShell({ identity: (user: Employee) => ({ detail: user.email }) });
// @ts-expect-error a user type that is not a session user (it has no id)
backofficeShell({ identity: (user: { name: string }) => ({ name: user.name }) });
// @ts-expect-error the logo is a component, not a string
backofficeShell({ brand: "logo" });

// --- the rows and actions contributed to the shell
h(AccountMenuItem, { label: "Dark mode", checked: true, icon: "close" });
h(HeaderAction, { label: "Search", icon: "search", badge: "dot" });
// @ts-expect-error an icon the application did not register
h(HeaderAction, { label: "Search", icon: "noSuchIcon" });
// @ts-expect-error a header action needs an accessible name
h(HeaderAction, { icon: "search" });
