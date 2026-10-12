// What the application says once about its session user and its config: every reader (`usePlatform()`,
// `useSessionUser()`, `createApplication`, `createTestPlatform`) is typed from it, with no cast and no generics.
import type { BootstrapConfig } from "@wssto2/vue-core/platform";

export interface AppUser {
  readonly id: number;
  readonly name: string;
  readonly locale: string;
}

export interface AppConfig extends BootstrapConfig {
  readonly market: string;
}

declare module "@wssto2/vue-core/platform" {
  interface PlatformRegistry {
    user: AppUser;
    config: AppConfig;
  }
}
