import { computed, type ComputedRef } from "vue";
import type { HttpClient } from "../../client";
import type { Device } from "../../modules/notification/entities";
import { notificationRoutes } from "../../modules/notification/routes";
import { usePlatform } from "../../platform";
import { useLoad, type Load } from "../../state";

/** The devices where the person turned push on, and what can be done with each. */
export interface Devices {
  readonly loaded: Load<Device[]>;
  readonly list: ComputedRef<readonly Device[]>;
  rename(id: number, label: string): Promise<void>;
  remove(id: number): Promise<void>;
  /** Sends a test push to one device; a refusal or a failure rejects. */
  test(id: number): Promise<void>;
}

/** The devices of the signed-in person, from `GET /v1/notifications/devices`. */
export function useDevices(http: HttpClient = usePlatform().http): Devices {
  const loaded = useLoad(async ({ signal }) => (await http.request(notificationRoutes.devices, undefined, { signal })).data.items);
  const list = computed(() => loaded.data.value ?? []);

  return {
    loaded,
    list,
    async rename(id, label) {
      const { data } = await http.request(notificationRoutes.deviceRename, { id, label });
      loaded.update(list.value.map((device) => (device.id === id ? data : device)));
    },
    async remove(id) {
      loaded.update((await http.request(notificationRoutes.deviceRemove, { id })).data.items);
    },
    async test(id) {
      loaded.update((await http.request(notificationRoutes.deviceTest, { id })).data.items);
    },
  };
}
