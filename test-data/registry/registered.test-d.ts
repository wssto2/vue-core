// A project that augments `PlatformRegistry`, checked by `npm run typecheck:registry` (the augmentation is
// global to a TypeScript project, so it cannot live beside the fixtures of an app that declares none).
import { createPlatform, parseBootstrap, usePlatform, type BootstrapConfig, type Platform, type SessionSnapshot } from "@wssto2/vue-core/platform";
import { createTestPlatform } from "@wssto2/vue-core/testing";

interface AppUser {
  readonly id: number;
  readonly name: string;
}
interface AppConfig extends BootstrapConfig {
  readonly market: string;
}

declare module "@wssto2/vue-core/platform" {
  interface PlatformRegistry {
    user: AppUser;
    config: AppConfig;
  }
}

// --- positive: the registered types flow to every reader, with no cast and no generics
const platform = usePlatform();
export const market: string = platform.config.market;
const state = platform.session.state.value;
export const name: string | undefined = state.status === "authenticated" ? state.user.name : undefined;
export const bare: Platform = platform;
export const explicit: Platform<AppUser, AppConfig> = platform;

// --- positive: the test platform has the registered user; the config's own fields are required there
export const tested = createTestPlatform({ user: { id: 1, name: "Ana" }, config: { market: "HR" } });
export const testedName: string | undefined = tested.session.state.value.status === "authenticated" ? tested.session.state.value.user.name : undefined;

// --- positive: createPlatform stays generic
const config = parseBootstrap({ locale: "hr", country: "HR" }, (fields) => ({ market: fields.string("country") }));
export const built: Platform<AppUser, AppConfig> = createPlatform<AppUser, AppConfig>({
  config,
  session: { load: async (): Promise<SessionSnapshot<AppUser> | null> => null, signOut: async () => {} },
});

// --- negative
// @ts-expect-error the registered user has no `email`
void (state.status === "authenticated" && state.user.email);
// @ts-expect-error the registered config's fields are required in a test platform
createTestPlatform({ config: {} });
