<script setup lang="ts">
import { useTemplateRef } from "vue";
import { Sheet } from "../modal";
import AccountMenuContent from "./AccountMenuContent.vue";
import type { ShellIdentity } from "./identity";

/**
 * The account actions on a phone: a bottom sheet with the same list as the desktop `AccountMenu`
 * popover, opened from the drawer's account row.
 *
 *   <AccountSheet ref="account" :identity="identity" />
 *   account.value?.present()
 */
defineProps<{ identity: ShellIdentity }>();

const sheet = useTemplateRef("sheet");

defineExpose({ present: () => sheet.value?.present(), dismiss: () => sheet.value?.dismiss() });
</script>

<template>
  <Sheet ref="sheet" :title="identity.name" grouped>
    <AccountMenuContent appearance="sheet" @close="sheet?.dismiss()" />
  </Sheet>
</template>
