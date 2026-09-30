<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { returnTo } from "@wssto2/vue-core/router";
import { usePlatform } from "@wssto2/vue-core/platform";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

const { http, session } = usePlatform();
const { t } = useI18n();
const route = useRoute();
const router = useRouter();

async function signIn() {
  await http.post("/auth/login", {});
  await session.refresh();
  await router.push(returnTo(route) ?? "/tickets");
}
</script>

<template>
  <div class="flex flex-col items-start gap-3">
    <h1 class="text-large-title font-semibold text-content-strong">{{ t("session.login.title") }}</h1>
    <Button prominence="primary" @click="signIn">{{ t("session.login.submit") }}</Button>
  </div>
</template>
