<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Button } from "../../button";
import { IconTile } from "../../controls";
import { useFormat } from "../../format";
import { FormGroup, FormRow } from "../../form";
import type { SessionItem } from "../../modules/identity/entities";
import { Badge } from "../../state";

/**
 * The live sessions of a person, one row per device: the device, where from, when last used and when it ends, a mark on the
 * one in use, the mark of a session somebody opened by signing in as the person, and "Sign out" per row. Shared by a
 * person's record and by "my profile", so it takes its data and its actions as props.
 */
const props = defineProps<{
  sessions: readonly SessionItem[];
  /** Whether a row can be ended. The session in use never can: leaving it is signing out. */
  canEnd: boolean;
  header?: string;
  footer?: string;
}>();

const emit = defineEmits<{ end: [session: SessionItem] }>();

const { t } = useI18n();
const format = useFormat();
</script>

<template>
  <FormGroup :header="props.header" :footer="props.footer">
    <FormRow v-if="props.sessions.length === 0" layout="setting" :label="t('core.account.sessions.empty')" />

    <FormRow v-for="session in props.sessions" :key="session.id" layout="setting" :label="session.device || t('core.account.sessions.unknown_device')" :data-session="session.id">
      <template #leading><IconTile tone="anchor" icon="deviceLine" /></template>
      <template #sub>
        <span class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span v-if="session.ip" class="font-mono">{{ session.ip }}</span>
          <span v-if="session.ip" aria-hidden="true">·</span>
          <span>{{ t("core.account.sessions.last_active", { when: format.dateTime(session.last_used_at) }) }}</span>
          <span aria-hidden="true">·</span>
          <span>{{ t("core.account.sessions.expires", { when: format.dateTime(session.expires_at) }) }}</span>
        </span>
        <span v-if="session.current || session.opened_by" class="mt-1 flex flex-wrap gap-1">
          <Badge v-if="session.current" tone="positive" dot data-session-current>{{ t("core.account.sessions.this_device") }}</Badge>
          <Badge v-if="session.opened_by" tone="warning" data-session-opened-by>
            {{ session.opened_by.name ? t("core.account.sessions.opened_by", { name: session.opened_by.name }) : t("core.account.sessions.opened_by_other") }}
          </Badge>
        </span>
      </template>
      <template v-if="props.canEnd && !session.current" #trailing>
        <Button prominence="plain" tone="critical" size="sm" :data-end-session="session.id" @click="emit('end', session)">{{ t("core.account.sessions.end") }}</Button>
      </template>
    </FormRow>
  </FormGroup>
</template>
