<script setup lang="ts">
import { FormGroup, FormRow } from "@wssto2/vue-core/form";
import { AdaptivePageShell } from "@wssto2/vue-core/page";
import { people, personTarget } from "./access";
</script>

<template>
  <AdaptivePageShell title="People">
    <FormGroup footer="Open a person to see and change their roles.">
      <FormRow v-for="person in people" :key="person.id" layout="setting" :label="person.name" :to="personTarget({ id: person.id })" />
    </FormGroup>
  </AdaptivePageShell>
</template>
