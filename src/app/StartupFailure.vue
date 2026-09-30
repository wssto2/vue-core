<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Button } from "../button";
import { EmptyState } from "../state";

/** Shown in place of the application when it could not start; the message says which part failed. */
defineProps<{ kind: "session" | "messages" | "startup" }>();
defineEmits<{ retry: [] }>();

const { t } = useI18n();
</script>

<template>
  <div class="mx-auto flex min-h-screen max-w-content items-center justify-center p-screen-padding">
    <EmptyState
      :title="t('core.startup.title')"
      :description="t(kind === 'startup' ? 'core.startup.other' : `core.startup.${kind}`)"
      icon="errorWarningLine"
    >
      <template #actions>
        <Button prominence="primary" icon="refreshLine" @click="$emit('retry')">{{ t("core.actions.retry") }}</Button>
      </template>
    </EmptyState>
  </div>
</template>
