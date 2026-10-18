import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "../overlay";
import { createTestApp, createTestPlatform, jsonResponse, routedTransport, withSetup } from "../testing";
import { usePreferences } from "./usePreferences";

afterEach(() => vi.restoreAllMocks());

const mount = (routes: Parameters<typeof routedTransport>[0]) => {
  const { transport, calls } = routedTransport(routes);
  const platform = createTestPlatform({ transport, preferences: { dark_mode: false } });
  const { result } = withSetup(() => usePreferences<{ dark_mode: boolean }>(), createTestApp({ platform }));
  return { preferences: result, platform, calls };
};

describe("usePreferences", () => {
  it("reads the session's preferences and saves, resolving true", async () => {
    const { preferences, platform } = mount({ "PUT /v1/auth/preferences": jsonResponse(200, { success: true, data: { preferences: { dark_mode: true } } }) });
    expect(preferences.value.value).toEqual({ dark_mode: false });
    expect(await preferences.save({ dark_mode: true })).toBe(true);
    expect(preferences.value.value).toEqual({ dark_mode: true });
    expect(platform.session.state.value).toMatchObject({ preferences: { dark_mode: true } });
  });

  it("takes a refused save back, says so in a toast and resolves false", async () => {
    const error = vi.spyOn(toast, "error");
    const { preferences } = mount({ "PUT /v1/auth/preferences": jsonResponse(500, { success: false, error: "boom" }) });
    expect(await preferences.save({ dark_mode: true })).toBe(false);
    expect(preferences.value.value).toEqual({ dark_mode: false });
    expect(error).toHaveBeenCalledWith("Your setting could not be saved.");
  });

  it("says nothing when the session ended meanwhile (the sign-in prompt already does)", async () => {
    const error = vi.spyOn(toast, "error");
    const { preferences } = mount({ "PUT /v1/auth/preferences": jsonResponse(401, { success: false, error: "unauthenticated" }) });
    expect(await preferences.save({ dark_mode: true })).toBe(false);
    expect(error).not.toHaveBeenCalled();
  });
});
