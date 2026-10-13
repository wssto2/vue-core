<script setup lang="ts">
import { ActionRow } from "@wssto2/vue-core/identity";
import type { ProfileResponse } from "@wssto2/vue-core/identity";
import { FormGroup, FormRow } from "@wssto2/vue-core/form";

// A group the application adds to "My profile" (profileSections): it renders its own FormGroup, like the built-in ones,
// and gets the loaded profile.
defineProps<{ profile: ProfileResponse }>();
</script>

<template>
  <FormGroup header="Mobile phone" footer="The application's own group, placed after the personal details.">
    <FormRow layout="setting" label="Mobile phone" :sub="`${profile.name}: +385 91 000 0000`" />
    <ActionRow label="Verify the number" sub="A code is sent by SMS." />
  </FormGroup>
</template>
