<script setup lang="ts">
import { Avatar } from "../content";
import type { PersonResponse } from "../modules/incident/entities";

/** A person of an incident (reporter, assignee, author of a comment): their initials, name and e-mail. */
defineProps<{ person: PersonResponse }>();
</script>

<template>
  <div class="flex min-w-0 items-center gap-2">
    <Avatar :name="person.name" size="xs" />
    <div class="flex min-w-0 flex-col items-start">
      <span class="max-w-full truncate text-xs font-semibold text-content-strong">{{ person.name }}</span>
      <span v-if="person.email" class="max-w-full truncate text-footnote text-content-muted">{{ person.email }}</span>
    </div>
  </div>
</template>
