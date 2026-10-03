// The module's route tables are called like any typed route.
import { identityRoutes } from "@wssto2/vue-core/identity";
import type { Platform } from "@wssto2/vue-core/platform";

export async function loadProfile(platform: Platform) {
  const { data } = await platform.http.request(identityRoutes.profileShow);
  return data; // ProfileResponse
}
