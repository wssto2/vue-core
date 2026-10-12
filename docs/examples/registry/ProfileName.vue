<script setup lang="ts">
import { ref } from "vue";
import { useSessionUser, usePlatform } from "@wssto2/vue-core/platform";

// `user` is the registered AppUser or null; `config.market` is typed too.
const user = useSessionUser();
const { http, session, config } = usePlatform();
const name = ref(user.value?.name ?? "");

async function save(): Promise<void> {
  if (!user.value) return;
  const { data } = await http.put<{ name: string }>("/profile", { name: name.value });
  // The same person, changed in place: nothing in flight is cancelled and nothing flickers (a different
  // person is `session.establish`, which throws here by design). `useSessionUser()` shows the new name.
  session.update({ user: { ...user.value, name: data.name } });
}
</script>

<template>
  <form @submit.prevent="save">
    <p>{{ user?.name }} ({{ config.market }})</p>
    <input v-model="name" />
    <button type="submit">Save</button>
  </form>
</template>
