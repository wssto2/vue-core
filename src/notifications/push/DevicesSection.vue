<script setup lang="ts">
import { ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "../../button";
import { IconTile } from "../../controls";
import { useFormat } from "../../format";
import { FormGroup, FormRow, TextField } from "../../form";
import { useServerMessages } from "../../identity/fieldMessages";
import type { Device } from "../../modules/notification/entities";
import SectionIntro from "../../identity/shared/SectionIntro.vue";
import { AlertDialog, Menu, MenuButton, toast, type MenuItem } from "../../overlay";
import { AsyncSection, Badge } from "../../state";
import type { Devices } from "./devices";

/**
 * The browsers where the person turned push on, one row each: the name (the server's, from the browser), "This device" on
 * the one in use, "Disabled" on one the server gave up on, when it was last used and last got a push. Rename in place,
 * send a test (not to a disabled device), remove after a confirmation: the three are the row's "⋯" menu.
 */
const props = defineProps<{ devices: Devices; hash: string | null }>();

const { t } = useI18n();
const format = useFormat();
const messages = useServerMessages();

const editing = ref<number | null>(null);
const label = ref("");
const saving = ref(false);
const testing = ref<number | null>(null);
const dialog = useTemplateRef<{ present: (device: Device) => void }>("dialog");
const pending = ref<Device | null>(null);

function startRename(device: Device) {
  editing.value = device.id;
  label.value = device.label;
}

async function saveRename() {
  const name = label.value.trim();
  if (editing.value === null || !name) return;
  saving.value = true;
  try {
    await props.devices.rename(editing.value, name);
    editing.value = null;
  } catch (error) {
    toast.error(messages.sentence(error, t("core.notifications.settings.devices.rename_error")));
  } finally {
    saving.value = false;
  }
}

async function sendTest(device: Device) {
  testing.value = device.id;
  try {
    await props.devices.test(device.id);
    toast.success(t("core.notifications.settings.devices.test_sent"));
  } catch (error) {
    toast.error(messages.sentence(error, t("core.notifications.settings.devices.test_error")));
  } finally {
    testing.value = null;
  }
}

/** The row menu: rename, send a test (not to a disabled device), and, last and in red, remove (which asks first). */
const actionsOf = (device: Device): MenuItem[] => [
  { id: "rename", label: t("core.notifications.settings.devices.rename"), icon: "edit", onSelect: () => startRename(device) },
  { id: "test", label: t("core.notifications.settings.devices.test"), icon: "notification3Line", disabled: !device.active, processing: testing.value === device.id, onSelect: () => void sendTest(device) },
  { id: "remove", label: t("core.notifications.settings.devices.remove"), icon: "deleteBin2Line", tone: "critical", onSelect: () => { pending.value = device; dialog.value?.present(device); } },
];

async function remove(device: Device) {
  try {
    await props.devices.remove(device.id);
  } catch (error) {
    toast.error(messages.sentence(error, t("core.notifications.settings.devices.remove_error")));
  }
}
</script>

<template>
  <section class="flex min-w-0 flex-col gap-group-gap" data-notification-devices>
    <SectionIntro :title="t('core.notifications.settings.devices.title')" :description="t('core.notifications.settings.devices.description')" />
    <AsyncSection :state="props.devices.loaded.state.value" :skeleton-rows="2" :empty-title="t('core.notifications.settings.devices.empty')" empty-icon="deviceLine" @retry="props.devices.loaded.reload()">
      <FormGroup>
        <template v-for="device in props.devices.list.value" :key="device.id">
          <template v-if="editing === device.id">
            <TextField v-model="label" :label="t('core.notifications.settings.devices.label')" :max-length="100" :data-device="device.id" />
            <div class="flex justify-end gap-2 p-3">
              <Button size="sm" @click="editing = null">{{ t("core.actions.cancel") }}</Button>
              <Button prominence="primary" size="sm" :processing="saving" :disabled="!label.trim()" data-device-save @click="saveRename">{{ t("core.actions.save") }}</Button>
            </div>
          </template>
          <FormRow v-else layout="setting" :label="device.label" :data-device="device.id">
            <template #leading><IconTile tone="anchor" icon="deviceLine" /></template>
            <template #sub>
              <span class="flex flex-col gap-0.5">
                <span>{{ t("core.notifications.settings.devices.last_seen", { when: format.dateTime(device.last_seen_at) }) }}</span>
                <span v-if="device.last_success_at">{{ t("core.notifications.settings.devices.last_push", { when: format.dateTime(device.last_success_at) }) }}</span>
              </span>
              <span v-if="device.endpoint_hash === props.hash || !device.active" class="mt-1 flex flex-wrap gap-1">
                <Badge v-if="device.endpoint_hash === props.hash" tone="positive" dot data-device-current>{{ t("core.notifications.settings.devices.this_device") }}</Badge>
                <Badge v-if="!device.active" tone="warning" data-device-disabled>{{ t("core.notifications.settings.devices.disabled") }}</Badge>
              </span>
            </template>
            <template #trailing>
              <Menu :items="actionsOf(device)" :label="t('core.notifications.settings.devices.menu', { label: device.label })">
                <template #trigger="trigger"><MenuButton v-bind="trigger" :label="t('core.notifications.settings.devices.menu', { label: device.label })" data-device-menu /></template>
              </Menu>
            </template>
          </FormRow>
        </template>
      </FormGroup>
    </AsyncSection>
    <AlertDialog ref="dialog" tone="critical" icon="deleteBin2Line" :title="t('core.notifications.settings.devices.remove_title')"
      :message="t('core.notifications.settings.devices.remove_body', { label: pending?.label ?? '' })" :confirm-label="t('core.notifications.settings.devices.remove')" :action="remove" />
  </section>
</template>
