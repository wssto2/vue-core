<script setup lang="ts">
import { useIncidentsContext } from "./context";
import ReportDialog from "./ReportDialog.vue";

/** Mounted once in the shell's `host` slot: the dialog the account menu's row opens, built only while it is open (the row unmounts with the menu, so it cannot own the dialog). */
const { reporting } = useIncidentsContext();
const close = () => {
  reporting.value = false;
};
</script>

<template>
  <ReportDialog v-if="reporting" auto-open @close="close" />
</template>
