<script setup lang="ts">
import { ref, watch, type ComponentInstance } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "../button";
import { Modal } from "../modal";
import { useInstallPrompt } from "./install";
import QrCode from "./QrCode.vue";

/**
 * "The application on your phone": the QR code of the address the user is signed in on and, in
 * Chrome or Edge on this computer, installing the application here with one click. Open it with
 * `v-model:open`; it closes itself and reports it.
 *
 *   <InstallQrSheet v-model:open="qrOpen" app-name="Helpdesk" />
 */
const props = defineProps<{
  appName: string;
  /** The address the code opens; the page's own origin by default. */
  url?: string;
}>();
const open = defineModel<boolean>("open", { default: false });

const { t } = useI18n();
const installer = useInstallPrompt();
const dialog = ref<ComponentInstance<typeof Modal> | null>(null);
const address = () => props.url ?? (typeof window === "undefined" ? "" : window.location.origin);

watch(open, (isOpen) => { if (isOpen) dialog.value?.present(); });
</script>

<template>
  <Modal ref="dialog" size="sm" :title="t('core.pwa.qr.title', { app: appName })" @dismissed="open = false">
    <div class="flex flex-col items-center gap-4 pb-2 text-center" data-test="install-qr-sheet">
      <QrCode :value="address()" :size="184" :label="t('core.pwa.qr.label', { app: appName })" />
      <p class="text-subheadline text-content-muted">{{ t("core.pwa.qr.text", { app: appName }) }}</p>
      <Button v-if="installer.canInstall.value" prominence="secondary" icon="download" @click="installer.install()">
        {{ t("core.pwa.qr.install_here") }}
      </Button>
    </div>
  </Modal>
</template>
