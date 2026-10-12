import { render } from "@testing-library/vue";
import { defineComponent, h } from "vue";
import { describe, it } from "vitest";
import { createTestPlatform } from "../testing/platform";
import { installPlatform } from "./platform";
import type { SessionUser } from "./session";
import { snapshotOf } from "./testing";
import { useSessionUser } from "./sessionUser";

function mountReader(platform: ReturnType<typeof createTestPlatform>) {
  const Reader = defineComponent({
    setup() {
      const user = useSessionUser();
      return () => h("p", { "data-test": "user" }, user.value === null ? "nobody" : String(user.value.id));
    },
  });
  return render(Reader, { global: { plugins: [{ install: (app) => installPlatform(app, platform) }] } });
}

describe("useSessionUser", () => {
  it("is the signed-in user, follows the session and is null when nobody is signed in", async () => {
    const platform = createTestPlatform({ user: { id: 7 } as SessionUser });
    const { findByText } = mountReader(platform);
    await findByText("7");
    platform.session.establish(snapshotOf(8));
    await findByText("8");
    await platform.session.signOut();
    await findByText("nobody");
  });

  it("is null before the session is asked", async () => {
    const platform = createTestPlatform({ user: null });
    const { findByText } = mountReader(platform);
    await findByText("nobody");
  });
});
