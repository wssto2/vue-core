// A project that augments `PlatformRegistry`, checked by `npm run typecheck:registry` (the augmentation is
// global to a TypeScript project, so it cannot live beside the fixtures of an app that declares none).
import { createPlatform, parseBootstrap, usePlatform, useSessionUser, type Platform, type SessionSnapshot } from "@wssto2/vue-core/platform";
import { createTestPlatform } from "@wssto2/vue-core/testing";

import type { AppConfig, AppUser } from "../../docs/examples/registry/declarations"; // the augmentation, shared with the recipe

// --- positive: the registered types flow to every reader, with no cast and no generics
const platform = usePlatform();
export const market: string = platform.config.market;
const state = platform.session.state.value;
export const name: string | undefined = state.status === "authenticated" ? state.user.name : undefined;
export const bare: Platform = platform;
export const explicit: Platform<AppUser, AppConfig> = platform;

// --- positive: the test platform has the registered user; the config's own fields are required there
export const tested = createTestPlatform({ user: { id: 1, name: "Ana", locale: "hr" }, config: { market: "HR" } });
export const testedName: string | undefined = tested.session.state.value.status === "authenticated" ? tested.session.state.value.user.name : undefined;

// --- positive: createPlatform stays generic
const config = parseBootstrap({ locale: "hr", country: "HR" }, (fields) => ({ market: fields.string("country") }));
export const built: Platform<AppUser, AppConfig> = createPlatform<AppUser, AppConfig>({
  config,
  session: { load: async (): Promise<SessionSnapshot<AppUser> | null> => null, signOut: async () => {} },
});

// --- positive: the session user reader and the in-place update are typed from it
export const signedIn: AppUser | null = useSessionUser().value;
platform.session.update({ user: { id: 1, name: "Ana Maria", locale: "en" } });

// --- negative
// @ts-expect-error an updated user is the registered one
platform.session.update({ user: { id: 1 } });
// @ts-expect-error the registered user has no `email`
void (state.status === "authenticated" && state.user.email);
// @ts-expect-error the registered config's fields are required in a test platform
createTestPlatform({ config: {} });
