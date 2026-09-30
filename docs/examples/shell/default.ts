import { createPlatform, httpSessionAdapter, readBootstrap, type SessionUser } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";
import Brand from "./Brand.vue";

// The application's own user: what its session adapter produces, and what the shell's `identity` is typed with.
interface Employee extends SessionUser {
  readonly name: string;
  readonly email: string;
}

export const platform = createPlatform({
  config: readBootstrap(),
  session: (http) => httpSessionAdapter(http, { parseUser: (raw) => raw as Employee }),
});

// Every option is optional: `backofficeShell()` alone shows the user's name and e-mail and the application's name.
export const shell = backofficeShell({
  identity: (user: Employee) => ({ name: user.name, detail: user.email }),
  brand: Brand,
  home: "/tickets",
});
