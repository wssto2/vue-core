<script setup lang="ts">
import { onBeforeUnmount, useTemplateRef, watch } from "vue";
import DiscardChangesModal from "../modal/DiscardChangesModal.vue";
import { useLeaveGuardContext } from "./leaveGuard";

/**
 * The one "Unsaved changes" dialog of the app's leave guard; mount it once, like the `Toaster`. `BackofficeShell` does; a shell of your own renders it.
 * Without one mounted a guarded leave fails with `MissingLeaveGuardRootError` instead of passing silently.
 * Only "Discard changes" lets the user go: Escape and "Continue editing" keep them where they are.
 *
 *   <LeaveGuardRoot />
 */
const guard = useLeaveGuardContext();
const detach = guard.attach();
onBeforeUnmount(detach);
const dialog = useTemplateRef<{ present: () => void }>("dialog");

watch(guard.pending, (question) => {
  if (question) dialog.value?.present();
});

const answer = (leave: boolean) => guard.pending.value?.resolve(leave);
</script>

<template>
  <DiscardChangesModal ref="dialog" @confirm="answer(true)" @cancel="answer(false)" @dismissed="answer(false)" />
</template>
