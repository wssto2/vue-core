import { computed, ref, type ComputedRef, type Ref } from "vue";
import type { HttpClient } from "../../client";
import { notificationRoutes } from "../../modules/notification/routes";
import { usePlatform } from "../../platform";
import { browserPush, type PushBrowser } from "./browser";
import { useThisDevice } from "./thisDevice";

/** This browser's push, for an application's own screens (an onboarding step): the same state the settings page shows. */
export interface PushState {
  /** Settled: `available`, `permission` and `subscribed` are read. Until then `subscribed` is false, so wait for it before offering push. */
  readonly ready: Readonly<Ref<boolean>>;
  /** The server has push and this browser can use it (not an old browser, not an iPhone Safari tab outside the home-screen app). */
  readonly available: ComputedRef<boolean>;
  /** The browser's permission; `unknown` where there is no Notification API. */
  readonly permission: Readonly<Ref<NotificationPermission | "unknown">>;
  /** This browser holds a push subscription, backed by the permission, which the server was given at sign-in or by `enable()`. */
  readonly subscribed: ComputedRef<boolean>;
  readonly busy: Readonly<Ref<boolean>>;
  /** Asks for the permission and registers this browser; call it from a tap. Resolves to `subscribed`. */
  enable(): Promise<boolean>;
  /** Stops push on this browser only. */
  disable(): Promise<void>;
}

/**
 * This browser's push state and its two actions, read at once when called (in `setup`). Built on what the notification settings page uses,
 * so a browser that already has push on is `subscribed` and an onboarding step does not offer it again.
 *
 *   const push = usePushState();
 *   // v-if="push.ready.value && push.available.value && !push.subscribed.value" -> <Button @click="push.enable()">
 */
export function usePushState(http: HttpClient = usePlatform().http, browser: PushBrowser = browserPush()): PushState {
  const device = useThisDevice(http, browser);
  const ready = ref(false);
  const serverPush = ref(false);
  const permission = ref<NotificationPermission | "unknown">("unknown");

  const refresh = async () => {
    await device.inspect();
    permission.value = browser.permission();
  };
  void Promise.all([
    refresh(),
    http.request(notificationRoutes.push, undefined).then(({ data }) => void (serverPush.value = data.enabled), () => undefined),
  ]).finally(() => void (ready.value = true));

  return {
    ready,
    available: computed(() => serverPush.value && (device.state.value === "off" || device.state.value === "on" || device.state.value === "denied")),
    permission,
    subscribed: computed(() => device.state.value === "on"),
    busy: device.busy,
    enable: async () => {
      const state = await device.enable();
      permission.value = browser.permission();
      return state === "on";
    },
    disable: device.disable,
  };
}
