<script setup lang="ts">
import { PersonAccess } from "@wssto2/vue-core/access";
import { AdaptivePageShell } from "@wssto2/vue-core/page";
import { computed } from "vue";
import { useRoute } from "vue-router";
import { people } from "./access";

const id = computed(() => Number(useRoute().params.id));
const person = computed(() => people.find((candidate) => candidate.id === id.value));
</script>

<template>
  <AdaptivePageShell :title="person?.name ?? 'Unknown person'" :back="{ label: 'People', to: { name: 'people' } }" width="content">
    <PersonAccess v-if="person" :subject="{ kind: 'user', id: person.id }" :name="person.name" />
  </AdaptivePageShell>
</template>
