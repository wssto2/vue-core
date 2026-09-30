<script setup lang="ts">
// A fixture (never mounted): an outlet names one of the documented slots.
import { ShellOutlet } from "@wssto2/vue-core/app";
</script>

<template>
  <ShellOutlet name="headerActions" />
  <!-- @vue-expect-error a slot the shell does not document -->
  <ShellOutlet name="footer" />
</template>
