<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { Panel } from "@wssto2/vue-core/content";
import { FormGroup, TextField } from "@wssto2/vue-core/form";
import { usePlatform, useSessionUser } from "@wssto2/vue-core/platform";
import { onMounted, ref, watch } from "vue";

// The typed session user and a profile save that changes it in place: no cast, and a session.update is not a sign-in.
const { session } = usePlatform();
const user = useSessionUser(); // Employee | null, from the PlatformRegistry the app declared
const name = ref("");
const saves = ref(0);

onMounted(() => void session.restore());
watch(user, (value) => (name.value ||= value?.name ?? ""), { immediate: true });

function save() {
  if (!user.value) return;
  session.update({ user: { ...user.value, name: name.value } });
  saves.value++;
}
</script>

<template>
  <Panel title="Signed-in user" subtitle="useSessionUser() and session.update()">
    <div class="flex flex-col gap-4">
      <p class="text-body text-content-strong">{{ user ? `${user.name} <${user.email}>` : "nobody" }}</p>
      <FormGroup>
        <TextField v-model="name" label="Name" />
      </FormGroup>
      <div class="flex items-center gap-3">
        <Button :disabled="!user" @click="save">Save in place</Button>
        <span class="text-footnote text-content-muted">{{ saves }} saved, session kept</span>
      </div>
    </div>
  </Panel>
</template>
