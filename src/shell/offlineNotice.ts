import { defineFeature, type Feature } from "../app/feature";
import OfflineNotice from "./OfflineNotice.vue";

/** The offline notice as an opt-in feature: mounts in the shell's `host` slot (on every page, signed in or not). */
export function offlineNotice(): Feature {
  return defineFeature({
    id: "vue-core.offline-notice",
    contributions: [{ id: "vue-core.offline-notice", slot: "host", component: OfflineNotice, scope: "always" }],
  });
}
