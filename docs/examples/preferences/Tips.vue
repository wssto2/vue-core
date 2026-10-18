<script setup lang="ts">
import { Tip } from "@wssto2/vue-core/onboarding";
import { ref } from "vue";

// The app's own sequencing: the tip waits until its welcome is over.
const welcomed = ref(true);
</script>

<template>
  <button type="button" data-test="quick-search">Search</button>

  <!-- Shown beside the button until the person closes it; the id is stored under onboarding.tips_dismissed. -->
  <Tip
    id="search"
    anchor="[data-test=quick-search]"
    :ready="welcomed"
    :dismissed-at="['onboarding', 'tips_dismissed']"
    title="Quick search"
    text="Press Ctrl + K to find a ticket, a person or a page."
  />
</template>
