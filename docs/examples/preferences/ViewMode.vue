<script setup lang="ts">
import { usePreferences } from "@wssto2/vue-core/identity";
import { computed } from "vue";

// The shape of what this application keeps for a person; the server stores whatever object it is given.
interface Preferences {
  dark_mode: boolean;
  tickets: { density: "comfortable" | "compact"; columns: string[] };
}

const preferences = usePreferences<Preferences>();
const density = computed(() => preferences.value.value.tickets?.density ?? "comfortable");

// On screen at once; sent as { preferences: { tickets: { density } } }; taken back with a toast when the server refuses.
const choose = (next: Preferences["tickets"]["density"]) => preferences.save({ tickets: { density: next } });
// `null` deletes a key; an array replaces the stored one.
const reset = () => preferences.save({ tickets: { density: null, columns: ["id", "subject"] } });
</script>

<template>
  <div role="group" aria-label="Density">
    <button type="button" :aria-pressed="density === 'comfortable'" @click="choose('comfortable')">Comfortable</button>
    <button type="button" :aria-pressed="density === 'compact'" @click="choose('compact')">Compact</button>
    <button type="button" @click="reset">Reset</button>
  </div>
</template>
