import { createTestPlatform } from "@wssto2/vue-core/testing";
import { preferencesOf } from "@wssto2/vue-core/platform";

// In a test the person starts with the preferences you give them; `save` needs a transport that answers PUT /v1/auth/preferences.
const platform = createTestPlatform({ preferences: { dark_mode: false } });
export const stored = preferencesOf<{ dark_mode: boolean }>(platform).value;
