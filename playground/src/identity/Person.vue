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
  <AdaptivePageShell :title="person?.name ?? `Person ${id}`" :back="{ label: 'People', to: { name: 'people' } }" width="content">
    <!-- A person the server does not reach (or know) answers 404: the screen says so. -->
    <PersonAccess :subject="{ kind: 'user', id }" :name="person?.name ?? `Person ${id}`" />
  </AdaptivePageShell>
</template>
