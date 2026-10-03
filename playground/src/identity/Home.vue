<script setup lang="ts">
import { SignInAsButton, type IdentityUser } from "@wssto2/vue-core/identity";
import { computed } from "vue";
import { usePlatform } from "@wssto2/vue-core/platform";

// What the dev server's session says about the person, as the library read it.
const { session } = usePlatform();
const user = computed(() => {
  const state = session.state.value;
  return state.status === "authenticated" ? (state.user as IdentityUser) : null;
});
</script>

<template>
  <div v-if="user" class="flex flex-col gap-2">
    <h1 class="text-large-title font-semibold text-content-strong">{{ user.name }}</h1>
    <p class="text-content-muted">{{ user.login }} · {{ user.email }} · {{ user.locale }}</p>
    <!-- The dev server lets admin sign in as user (id 2): the banner appears, with the way back. -->
    <div><SignInAsButton :user-id="2" name="user" permission="iam.user:impersonate" /></div>
    <!-- Enough page to scroll: the banner stays at the top and the bars sit below it. -->
    <p v-for="n in 60" :key="n" class="text-content-muted">Line {{ n }}</p>
  </div>
</template>
