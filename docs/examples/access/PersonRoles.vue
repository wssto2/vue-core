<script setup lang="ts">
import { PersonAccess } from "@wssto2/vue-core/access";

// A section of the person's record: their roles, with where each applies, and what they can do.
defineProps<{ person: { id: number; name: string } }>();
</script>

<template>
  <PersonAccess :subject="{ kind: 'user', id: person.id }" :name="person.name" />
</template>
