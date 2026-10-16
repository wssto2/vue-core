<script setup lang="ts">
import { CommentThread, type CommentItem } from "@wssto2/vue-core/content";
import { toast } from "@wssto2/vue-core/overlay";
import { usePlatform } from "@wssto2/vue-core/platform";
import { useI18n } from "vue-i18n";

// The comments are the record's; saving and deleting are the application's calls. The thread owns the draft.
defineProps<{ comments: CommentItem[] }>();
const emit = defineEmits<{ add: [text: string]; remove: [comment: CommentItem] }>();

const { t } = useI18n();
const { access } = usePlatform();

// A thread awaits what it is given: returning false keeps the draft, so a refused or failed save loses nothing.
function add(text: string) {
  if (text.length > 1000) {
    toast.error(t("tickets.comment_too_long"));
    return false;
  }
  emit("add", text);
}
</script>

<template>
  <CommentThread :comments="comments" :can-add="access.can('tickets:update')" :can-remove="access.can('tickets:update')" :on-add="add" @remove="emit('remove', $event)" />
</template>
