<script setup lang="ts">
import { SignInAsButton } from "@wssto2/vue-core/identity";

defineProps<{ person: { id: number; name: string } }>();
</script>

<template>
  <!-- Shown to whoever holds the permission; the server decides again. -->
  <SignInAsButton :user-id="person.id" :name="person.name" permission="tickets:update" />
</template>
