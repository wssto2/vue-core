<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Button } from "@wssto2/vue-core/button";
import { useDescribeError } from "@wssto2/vue-core/i18n";
import { toast } from "@wssto2/vue-core/overlay";
import { usePlatform } from "@wssto2/vue-core/platform";

const props = defineProps<{ planId: number }>();
const { t } = useI18n();
const { http } = usePlatform();
const describeError = useDescribeError(); // call it in setup; use the function anywhere later

async function archive() {
  try {
    await http.delete(`/plans/${props.planId}`);
    toast.success(t("accounts.archived"));
  } catch (error) {
    // The backend's reason when you have a text for it, else a sentence for the kind of failure (signed out, no access,
    // not found, offline, "check the marked fields"); your fallback for a server fault and anything unreadable.
    toast.error(describeError(error, { fallback: t("accounts.archive_failed") }));
  }
}
</script>

<template>
  <Button tone="critical" @click="archive">{{ t("accounts.archive") }}</Button>
</template>
