<script setup lang="ts">
import { usePlatform } from "@wssto2/vue-core/platform";
import { Button } from "@wssto2/vue-core/button";
import { useI18n } from "vue-i18n";

// A header contribution of the session feature: shown only while signed in.
const { session } = usePlatform();
const { t } = useI18n();
</script>

<template>
  <Button prominence="plain" @click="session.signOut()">{{ t("session.sign_out") }}</Button>
</template>
