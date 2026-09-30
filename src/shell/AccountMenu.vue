<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Avatar } from "../content";
import { Icon } from "../icon";
import { Popover } from "../overlay";
import AccountMenuContent from "./AccountMenuContent.vue";
import type { ShellIdentity } from "./identity";

/**
 * The account block at the bottom of the desktop sidebar: who is signed in, and a popover with the
 * account actions: the entries features contributed (`accountMenu` slot), the language when the
 * application offers more than one, and Sign out. The phone drawer opens the same list in an
 * `AccountSheet`.
 *
 *   <AccountMenu :identity="identity" />
 */
defineProps<{ identity: ShellIdentity }>();

const { t } = useI18n();
</script>

<template>
  <Popover placement="top-start" width="sm" block :arrow="false" :label="t('core.shell.account.open')">
    <template #trigger="{ toggle, attrs, presented }">
      <button type="button" v-bind="attrs" data-shell-account
        class="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus"
        :class="{ 'bg-white/10': presented }" @click="toggle">
        <Avatar :name="identity.name" size="md" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-semibold text-white">{{ identity.name }}</span>
          <span v-if="identity.detail" class="block truncate text-xs text-gray-300">{{ identity.detail }}</span>
        </span>
        <Icon name="expandUpDownLine" :size="16" class="shrink-0 text-gray-400" />
      </button>
    </template>
    <template #default="{ dismiss }">
      <AccountMenuContent appearance="popover" @close="dismiss" />
    </template>
  </Popover>
</template>
