<script setup lang="ts">
import { computed, onMounted } from "vue";
import type { Preferences } from "../../modules/notification/entities";
import { useNotificationsContext } from "../context";
import DevicesPanel from "../push/DevicesPanel.vue";
import ThisDevicePanel from "../push/ThisDevicePanel.vue";
import { useDevices } from "../push/devices";
import { useThisDevice } from "../push/thisDevice";
import ChannelsPanel from "./ChannelsPanel.vue";
import QuietHoursPanel from "./QuietHoursPanel.vue";
import type { Settings } from "./settings";
import type { Channel } from "./state";

/**
 * The panels of the settings page in their order: the built-in ones (channels 0, quiet hours 10, this device 20, devices 30)
 * and the application's own sections. Push is created only here, once the preferences say the server has it.
 */
const props = defineProps<{ preferences: Preferences; settings: Settings }>();
const emit = defineEmits<{ change: [category: string, channel: Channel, enabled: boolean] }>();

const context = useNotificationsContext();
const withPush = context.push && props.preferences.push_available;
const device = withPush ? useThisDevice() : null;
const devices = withPush ? useDevices() : null;
onMounted(() => void device?.inspect());

const entries = computed(() =>
  [
    { id: "channels", order: 0 },
    ...(props.preferences.email_available || withPush ? [{ id: "quiet", order: 10 }] : []),
    ...(withPush ? [{ id: "device", order: 20 }, { id: "devices", order: 30 }] : []),
    ...context.sections.filter((section) => section.visible?.(props.preferences) ?? true).map((section, index) => ({ id: section.id, order: section.order ?? 100 + index, section })),
  ].sort((a, b) => a.order - b.order),
);
</script>

<template>
  <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
    <template v-for="entry in entries" :key="entry.id">
      <ChannelsPanel v-if="entry.id === 'channels'" :preferences="props.preferences" @change="(...args) => emit('change', ...args)" />
      <QuietHoursPanel v-else-if="entry.id === 'quiet'" :quiet-hours="props.preferences.quiet_hours" :time-zone="props.preferences.time_zone" :submit="props.settings.saveQuietHours" />
      <ThisDevicePanel v-else-if="entry.id === 'device' && device" :device="device" @changed="devices?.loaded.reload()" />
      <DevicesPanel v-else-if="entry.id === 'devices' && devices" :devices="devices" :hash="device?.hash.value ?? null" />
      <component :is="entry.section.component" v-else-if="'section' in entry" :preferences="props.preferences" :data-settings-section="entry.id" />
    </template>
  </div>
</template>
