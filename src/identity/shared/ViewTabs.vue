<script setup lang="ts" generic="View extends string">
import { computed } from "vue";
import { Tabs } from "../../controls";
import type { ViewCount } from "../../client";

/**
 * The tabs over a person's history ("All / Failed", "All / Access / Details") with the server's counts (`meta.views`).
 * The tabs are always there, so the bar does not appear and disappear with the answer; a count shows once it is known.
 */
const props = defineProps<{ views: readonly View[]; counts?: readonly ViewCount[]; labelOf: (view: View) => string; label: string }>();
const model = defineModel<View>({ required: true });

const tabs = computed(() => props.views.map((view) => ({ value: view, label: props.labelOf(view), badge: props.counts?.find((count) => count.key === view)?.count })));
</script>

<template>
  <Tabs v-model="model" :tabs="tabs" presentation="scope" :label="props.label" />
</template>
