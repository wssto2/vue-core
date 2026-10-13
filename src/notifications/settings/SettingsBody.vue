<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import type { Preferences } from "../../modules/notification/entities";
import { useNotificationsContext } from "../context";
import SectionIntro from "../../identity/shared/SectionIntro.vue";
import DevicesSection from "../push/DevicesSection.vue";
import ThisDeviceSection from "../push/ThisDeviceSection.vue";
import { useDevices } from "../push/devices";
import { useThisDevice } from "../push/thisDevice";
import ChannelsSection from "./ChannelsSection.vue";
import QuietHoursSection from "./QuietHoursSection.vue";
import type { Settings } from "./settings";
import type { Channel } from "./state";

/**
 * The sections of the settings page in their order: the built-in ones (channels 0, quiet hours 10, this device 20, devices 30)
 * and the application's own sections (each under its own title, like the built-in ones). Push is created only here, once the preferences say the server has it.
 */
const props = defineProps<{ preferences: Preferences; settings: Settings }>();
const emit = defineEmits<{ change: [category: string, channel: Channel, enabled: boolean] }>();

const { t } = useI18n();
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
  <div class="flex flex-col gap-10">
    <template v-for="entry in entries" :key="entry.id">
      <ChannelsSection v-if="entry.id === 'channels'" :preferences="props.preferences" @change="(...args) => emit('change', ...args)" />
      <QuietHoursSection v-else-if="entry.id === 'quiet'" :quiet-hours="props.preferences.quiet_hours" :time-zone="props.preferences.time_zone" :submit="props.settings.saveQuietHours" />
      <ThisDeviceSection v-else-if="entry.id === 'device' && device" :device="device" @changed="devices?.loaded.reload()" />
      <DevicesSection v-else-if="entry.id === 'devices' && devices" :devices="devices" :hash="device?.hash.value ?? null" />
      <section v-else-if="'section' in entry" class="flex min-w-0 flex-col gap-group-gap" :data-settings-section="entry.id">
        <SectionIntro :title="t(entry.section.titleKey)" :description="entry.section.descriptionKey ? t(entry.section.descriptionKey) : undefined" />
        <component :is="entry.section.component" :preferences="props.preferences" />
      </section>
    </template>
  </div>
</template>
