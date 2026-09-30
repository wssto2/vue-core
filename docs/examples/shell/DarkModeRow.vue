<script setup lang="ts">
import { AccountMenuItem } from "@wssto2/vue-core/shell";
import { ref } from "vue";

// A row of the account menu: a switch. The state lives on <html>, where the stylesheet reads it.
const dark = ref(document.documentElement.classList.contains("dark"));

function toggle() {
  dark.value = !dark.value;
  document.documentElement.classList.toggle("dark", dark.value);
}
</script>

<template>
  <AccountMenuItem label="Dark mode" :checked="dark" @click="toggle" />
</template>
