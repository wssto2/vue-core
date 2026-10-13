<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { IconTile } from "../../controls";
import { useFormat } from "../../format";
import { FormGroup, FormRow } from "../../form";
import type { SignInRow } from "../../modules/identity/entities";
import { Badge } from "../../state";
import { deviceLabel } from "./deviceLabel";
import { signInEventKey, signInEventStyle } from "./signInEvents";

/**
 * A person's sign-in history as a grouped list, one row per sign-in: the device as sessions name it ("Chrome · Linux"), when
 * and from which address, and what happened as a badge (with who did it, for the events somebody else does). The raw
 * User-Agent is the row's tooltip.
 */
const props = defineProps<{ rows: readonly SignInRow[]; header?: string; footer?: string }>();
defineSlots<{ "header-trailing"?: () => unknown }>();

const { t } = useI18n();
const format = useFormat();
const words = (row: SignInRow) => t(signInEventKey(row.event, row.actor?.name || null), { name: row.actor?.name ?? "" });
</script>

<template>
  <FormGroup :header="props.header" :footer="props.footer" data-signin-list>
    <template v-if="$slots['header-trailing']" #header-trailing><slot name="header-trailing" /></template>
    <FormRow v-if="props.rows.length === 0" layout="setting" :label="t('core.account.signins.empty')" data-signin-empty />
    <FormRow v-for="row in props.rows" :key="row.id" layout="setting" :label="deviceLabel(row.device) || t('core.account.sessions.unknown_device')" data-signin-row>
      <template #leading><IconTile tone="neutral" icon="timeLine" /></template>
      <template #sub>
        <span class="flex flex-col gap-y-0.5 md:flex-row md:flex-wrap md:items-center md:gap-x-1.5" :title="row.device" data-signin-facts>
          <span>{{ format.dateTime(row.created_at) }}</span>
          <template v-if="row.ip">
            <span aria-hidden="true" class="hidden md:inline">·</span>
            <span class="font-mono">{{ row.ip }}</span>
          </template>
        </span>
      </template>
      <Badge :tone="signInEventStyle(row.event).tone" :data-event="row.event">{{ words(row) }}</Badge>
    </FormRow>
  </FormGroup>
</template>
