<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Button } from "../../button";
import { useLeaveGuard } from "../../form";

/**
 * The action row at the foot of a panel that edits: one primary button saying what it does (with a spinner while it works),
 * "Unsaved changes" and Cancel while there are edits, and, while it shows, leaving the page asks first.
 */
const props = defineProps<{ label: string; processing?: boolean; dirty: boolean }>();
const emit = defineEmits<{ submit: []; cancel: [] }>();

const { t } = useI18n();
useLeaveGuard(() => props.dirty);
</script>

<template>
  <div class="flex flex-wrap items-center justify-end gap-3">
    <span v-if="props.dirty" class="mr-auto text-footnote text-content-muted" data-unsaved>{{ t("core.form.unsaved_changes") }}</span>
    <Button v-if="props.dirty" :disabled="props.processing" @click="emit('cancel')">{{ t("core.actions.cancel") }}</Button>
    <Button prominence="primary" :processing="props.processing" @click="emit('submit')">{{ props.label }}</Button>
  </div>
</template>
