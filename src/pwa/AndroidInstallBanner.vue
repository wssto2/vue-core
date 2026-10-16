<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "../button";
import { Icon } from "../icon";
import { useInstallPrompt } from "./install";

/**
 * Installing the application on Android: one tap opens the system's own install dialog. Shown by
 * the application when `useInstallPrompt().canInstall` is true; `close` fires when the user
 * installs or dismisses it, and the application keeps it closed.
 *
 *   <AndroidInstallBanner v-if="canInstall && !dismissed" app-name="Helpdesk" @close="dismissed = true" />
 */
const props = defineProps<{
  appName: string;
  /** The tile's letters; the first three of the name by default. */
  badge?: string;
}>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const installer = useInstallPrompt();
const busy = ref(false);

async function install() {
  busy.value = true;
  try {
    if (await installer.install()) emit("close");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-x-3 bottom-[calc(var(--bottom-dock-h,0px)+env(safe-area-inset-bottom)+0.75rem)] z-40 flex animate-reveal items-center gap-3 rounded-2xl bg-surface-cell px-4 py-3.5 shadow-dialog"
      data-test="install-android-banner">
      <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-tint text-footnote font-semibold text-content-on-tint">{{ props.badge ?? props.appName.slice(0, 3).toUpperCase() }}</span>
      <span class="flex flex-1 flex-col">
        <span class="text-subheadline font-semibold text-content-strong">{{ t("core.pwa.android.title", { app: appName }) }}</span>
        <span class="text-footnote text-content-muted">{{ t("core.pwa.android.text") }}</span>
      </span>
      <Button prominence="primary" size="sm" :processing="busy" @click="install">{{ t("core.pwa.android.install") }}</Button>
      <button type="button" class="hit-target grid size-7 place-items-center rounded-full bg-fill text-content-muted" :aria-label="t('core.actions.close')" @click="emit('close')">
        <Icon name="close" :size="12" />
      </button>
    </div>
  </Teleport>
</template>
