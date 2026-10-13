<script setup lang="ts">
import { usePushState } from "@wssto2/vue-core/notifications";

// An onboarding step: offer push only to a browser that can have it and does not yet.
const push = usePushState();
</script>

<template>
  <p v-if="push.permission.value === 'denied'">Notifications are blocked in this browser.</p>
  <button v-else-if="push.ready.value && push.available.value && !push.subscribed.value" :disabled="push.busy.value" @click="push.enable()">Turn on notifications</button>
</template>
