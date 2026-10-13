<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { FormGroup, FormRow } from "../../form";
import ActionRow from "../../identity/shared/ActionRow.vue";
import SectionIntro from "../../identity/shared/SectionIntro.vue";
import { toast } from "../../overlay";
import { Badge } from "../../state";
import type { ThisDevice } from "./thisDevice";

/**
 * Push on this browser, one state at a time: still reading it, not supported, an iPhone Safari tab (add the app to the
 * home screen first), blocked (how to allow it again), off (turn it on from a tap), on. The permission prompt only ever
 * comes from the action row.
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
  <section class="flex min-w-0 flex-col gap-group-gap" :data-state="props.device.state.value" data-notification-this-device>
    <SectionIntro :title="t('core.notifications.settings.push.title')" :description="t('core.notifications.settings.push.description')" />
    <div v-if="props.device.state.value === 'loading'" class="h-14 animate-pulse rounded-xl bg-fill-strong motion-reduce:animate-none" aria-hidden="true" />

    <FormGroup v-else-if="props.device.state.value === 'unsupported'">
      <FormRow layout="setting" :label="t('core.notifications.settings.push.unsupported')" />
    </FormGroup>

    <FormGroup v-else-if="props.device.state.value === 'ios-browser'" :header="t('core.notifications.settings.push.ios_title')">
      <FormRow layout="setting" :label="`1. ${t('core.notifications.settings.push.ios_step_share')}`" />
      <FormRow layout="setting" :label="`2. ${t('core.notifications.settings.push.ios_step_add')}`" />
      <FormRow layout="setting" :label="`3. ${t('core.notifications.settings.push.ios_step_open')}`" />
    </FormGroup>

    <FormGroup v-else-if="props.device.state.value === 'denied'">
      <FormRow layout="setting" :label="t('core.notifications.settings.push.denied_title')" :sub="t('core.notifications.settings.push.denied_help')" />
    </FormGroup>

    <FormGroup v-else>
      <FormRow layout="setting" :label="props.device.state.value === 'on' ? t('core.notifications.settings.push.on_description') : t('core.notifications.settings.push.off_description')">
        <Badge :tone="props.device.state.value === 'on' ? 'positive' : 'neutral'" dot>{{ props.device.state.value === "on" ? t("core.notifications.settings.push.on") : t("core.notifications.settings.push.off") }}</Badge>
      </FormRow>
      <ActionRow v-if="props.device.state.value === 'off'" :label="t('core.notifications.settings.push.enable')" :disabled="props.device.busy.value" data-push-enable @click="enable" />
      <ActionRow v-else :label="t('core.notifications.settings.push.disable')" tone="critical" :disabled="props.device.busy.value" data-push-disable @click="disable" />
    </FormGroup>
  </section>
</template>
