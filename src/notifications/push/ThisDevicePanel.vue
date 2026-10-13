<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Button } from "../../button";
import { Panel } from "../../content";
import { toast } from "../../overlay";
import { Badge, Banner } from "../../state";
import type { ThisDevice } from "./thisDevice";

/**
 * Push on this browser, one state at a time: still reading it, not supported, an iPhone Safari tab (add the app to the
 * home screen first), blocked (how to allow it again), off (turn it on from a tap), on. The permission prompt only ever
 * comes from the button.
 */
const props = defineProps<{ device: ThisDevice }>();
const emit = defineEmits<{ changed: [] }>();

const { t } = useI18n();

async function enable() {
  try {
    if ((await props.device.enable()) === "on") toast.success(t("core.notifications.settings.push.enabled_toast"));
    emit("changed");
  } catch {
    toast.error(t("core.notifications.settings.push.enable_error"));
  }
}

async function disable() {
  try {
    await props.device.disable();
  } catch {
    toast.error(t("core.notifications.settings.push.disable_error"));
  }
  emit("changed");
}
</script>

<template>
  <Panel :title="t('core.notifications.settings.push.title')" icon="deviceLine" data-notification-this-device>
    <div class="flex flex-col gap-4" :data-state="props.device.state.value">
      <div v-if="props.device.state.value === 'loading'" class="h-12 animate-pulse rounded-md bg-fill-strong motion-reduce:animate-none" />

      <Banner v-else-if="props.device.state.value === 'unsupported'" tone="neutral">{{ t("core.notifications.settings.push.unsupported") }}</Banner>

      <Banner v-else-if="props.device.state.value === 'ios-browser'" tone="info" icon="deviceLine">
        <p class="font-medium">{{ t("core.notifications.settings.push.ios_title") }}</p>
        <ol class="mt-1 list-decimal space-y-0.5 pl-5">
          <li>{{ t("core.notifications.settings.push.ios_step_share") }}</li>
          <li>{{ t("core.notifications.settings.push.ios_step_add") }}</li>
          <li>{{ t("core.notifications.settings.push.ios_step_open") }}</li>
        </ol>
      </Banner>

      <Banner v-else-if="props.device.state.value === 'denied'" tone="warning">
        <p class="font-medium">{{ t("core.notifications.settings.push.denied_title") }}</p>
        <p class="mt-1">{{ t("core.notifications.settings.push.denied_help") }}</p>
      </Banner>

      <template v-else>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="min-w-0 flex-1 text-subheadline text-content-muted">
            {{ props.device.state.value === "on" ? t("core.notifications.settings.push.on_description") : t("core.notifications.settings.push.off_description") }}
          </p>
          <Badge :tone="props.device.state.value === 'on' ? 'positive' : 'neutral'" dot>
            {{ props.device.state.value === "on" ? t("core.notifications.settings.push.on") : t("core.notifications.settings.push.off") }}
          </Badge>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button v-if="props.device.state.value === 'off'" prominence="primary" icon="notification3Line" :processing="props.device.busy.value" data-push-enable @click="enable">{{ t("core.notifications.settings.push.enable") }}</Button>
          <Button v-else :processing="props.device.busy.value" data-push-disable @click="disable">{{ t("core.notifications.settings.push.disable") }}</Button>
        </div>
      </template>
    </div>
  </Panel>
</template>
