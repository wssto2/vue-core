<script setup lang="ts">
import { onScopeDispose, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";
import { BottomDockPortal } from "../page";

/**
 * No connection: a quiet notice in the bottom dock rather than a failed request per action; it
 * clears itself when the connection is back. Mounted by `offlineNotice()`, or place it yourself.
 */
const { t } = useI18n();

const online = ref(navigator.onLine);
const update = () => (online.value = navigator.onLine);
window.addEventListener("online", update);
window.addEventListener("offline", update);
onScopeDispose(() => {
  window.removeEventListener("online", update);
  window.removeEventListener("offline", update);
});
</script>

<template>
  <BottomDockPortal>
    <Transition enter-active-class="transition duration-motion-normal ease-motion-standard" enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-motion-fast ease-motion-standard" leave-to-class="translate-y-2 opacity-0">
      <div v-if="!online" role="status" data-test="offline-notice" class="dock-safe-area pointer-events-auto order-first mb-3 px-3">
        <div class="mx-auto flex max-w-md items-center justify-center gap-2 rounded-full bg-status-warning-surface px-4 py-2 text-subheadline font-semibold text-status-warning-content shadow-float">
          <Icon name="errorWarningLine" :size="16" />
          {{ t("core.shell.offline") }}
        </div>
      </div>
    </Transition>
  </BottomDockPortal>
</template>
