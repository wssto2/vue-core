<script setup lang="ts">
import { Panel } from "@wssto2/vue-core/content";
import type { ProfileResponse } from "@wssto2/vue-core/identity";

// A panel the application adds to "My profile" (profileSections): it gets the loaded profile.
defineProps<{ profile: ProfileResponse }>();
</script>

<template>
  <Panel title="Mobile phone" subtitle="The application's own panel, placed after the details.">
    <p class="text-body text-content-muted">{{ profile.name }}: +385 91 000 0000</p>
  </Panel>
</template>
