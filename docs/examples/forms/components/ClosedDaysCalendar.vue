<script setup lang="ts">
import { Calendar } from "@wssto2/vue-core/form";
import { ref } from "vue";

const day = ref<string | null>(null);
// Single days and { from, to } ranges (both included); a function `(day) => boolean` says anything else.
const closed = [{ from: "2026-12-24", to: "2026-12-26" }, "2026-12-31"];
</script>

<template>
  <Calendar v-model="day" min="2026-10-01" :disabled-dates="closed" />
</template>
