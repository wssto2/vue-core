<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import Button from "../button/Button.vue";
import { useDescribeError } from "../i18n/describeError";
import Modal from "../modal/Modal.vue";
import type { UsageResponse } from "../modules/characteristics/entities";
import AlertDialog from "../overlay/AlertDialog.vue";
import { toast } from "../overlay";
import Banner from "../state/Banner.vue";
import { useCharacteristicsApi } from "./api";
import type { CharacteristicNode } from "./model";

/**
 * Deleting an item, after the server says where it is used (`GET .../usage`): "Used by 2 pages and 1 host", "has 3 items below it", or that where
 * it is used is not known. Each of those means a delete would take something with it, so the dialog offers to deactivate instead (the item
 * stays, and leaves the forms' choices), and deleting needs a second confirmation that sends `force`. An item nothing uses and nothing hangs
 * under is deleted by one click, without `force`. Opened with `show(node)`.
 */
defineProps<{
  /** Whether the item has a switch: only then can it be deactivated instead. */
  canDeactivate: (node: CharacteristicNode) => boolean;
}>();
const emit = defineEmits<{ deleted: [node: CharacteristicNode]; deactivate: [node: CharacteristicNode] }>();

const { t } = useI18n();
const api = useCharacteristicsApi();
const describeError = useDescribeError();
const modal = useTemplateRef<{ present: () => void; dismiss: () => void }>("modal");
const confirm = useTemplateRef<{ present: () => void }>("confirm");

const node = ref<CharacteristicNode | null>(null);
const usage = ref<UsageResponse | null>(null);
const status = ref<"loading" | "ready" | "failed">("loading");
const busy = ref(false);

async function show(next: CharacteristicNode) {
  node.value = next;
  usage.value = null;
  status.value = "loading";
  modal.value?.present();
  try {
    usage.value = await api.usage(next.level, next.item.id);
    status.value = "ready";
  } catch {
    status.value = "failed";
  }
}

const uses = computed(() => (usage.value?.uses ?? []).filter((use) => use.count > 0));
const children = computed(() => usage.value?.children ?? 0);
/** A delete without `force` is refused (or cannot be told to be safe) unless nothing uses the item and nothing is below it. */
const risky = computed(() => status.value !== "ready" || usage.value?.known === false || uses.value.length > 0 || children.value > 0);
const usedBy = computed(() => {
  const parts = uses.value.map((use) => `${use.count} ${use.what}`);
  return parts.length < 2 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} ${t("core.characteristics.delete_dialog.and")} ${parts[parts.length - 1]}`;
});

async function erase(force: boolean) {
  const current = node.value;
  if (current === null) return;
  try {
    await api.remove(current.level, current.item.id, force);
  } catch (error) {
    toast.error(describeError(error, { fallback: t("core.resource.unavailable") }));
    throw error;
  }
  toast.success(t("core.characteristics.toasts.deleted"));
  emit("deleted", current);
  modal.value?.dismiss();
}

async function primary() {
  if (risky.value) return confirm.value?.present();
  busy.value = true;
  try {
    await erase(false);
  } catch {
    void show(node.value as CharacteristicNode); // refused after all (it was used meanwhile): read the usage again
  } finally {
    busy.value = false;
  }
}

defineExpose({ show });
</script>

<template>
  <Modal ref="modal" size="md" without-footer :title="t('core.characteristics.delete_dialog.title', { name: node?.item.name ?? '' })" @dismissed="node = null">
    <div class="flex flex-col gap-3 text-body" data-test="characteristic-usage" :aria-busy="status === 'loading' || undefined">
      <p v-if="status === 'loading'" class="text-content-muted">{{ t("core.characteristics.delete_dialog.checking") }}</p>
      <Banner v-else-if="status === 'failed'" tone="critical" icon="errorWarningLine">{{ t("core.characteristics.delete_dialog.usage_failed") }}</Banner>
      <template v-else>
        <p v-if="usage?.known === false" data-test="usage-unknown">{{ t("core.characteristics.delete_dialog.unknown") }}</p>
        <p v-else-if="uses.length > 0" data-test="usage-uses">{{ t("core.characteristics.delete_dialog.used", { uses: usedBy }) }}</p>
        <p v-if="children > 0" data-test="usage-children">{{ t("core.characteristics.delete_dialog.children", children) }}</p>
        <Banner v-if="risky" tone="warning" icon="alertTriangle">{{ t("core.characteristics.delete_dialog.warning") }}</Banner>
      </template>
      <!-- Deactivating is the safe way out, so it is the primary action; deleting is the danger one. One row where it fits. -->
      <div class="flex flex-wrap items-center justify-end gap-2 pt-1" data-test="delete-actions">
        <Button prominence="plain" @click="modal?.dismiss()">{{ t("core.actions.cancel") }}</Button>
        <Button tone="critical" icon="deleteBin2Line" :disabled="status === 'loading' || busy" :processing="busy" data-test="characteristic-delete-confirm" @click="primary()">{{ risky && status === 'ready' ? t("core.characteristics.delete_dialog.delete_anyway") : t("core.characteristics.delete_dialog.delete") }}</Button>
        <Button v-if="node && canDeactivate(node) && node.item.active" prominence="primary" data-test="characteristic-deactivate" @click="emit('deactivate', node); modal?.dismiss()">{{ t("core.characteristics.delete_dialog.deactivate") }}</Button>
      </div>
    </div>
  </Modal>
  <AlertDialog ref="confirm" tone="critical" :title="t('core.characteristics.delete_dialog.confirm_title')" :message="t('core.characteristics.delete_dialog.confirm_message', { name: node?.item.name ?? '' })"
    :confirm-label="t('core.characteristics.delete_dialog.confirm_action')" icon="deleteBin2Line" :action="() => erase(true)" />
</template>
