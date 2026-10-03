<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { Button } from "../button";
import { useDescribeError } from "../i18n";
import { toast } from "../overlay";
import { AccessGate, heldSession, usePlatform, type Permission } from "../platform";
import { useIdentityContext } from "./context";
import { signInAs } from "./signIn";

/**
 * The "sign in as" entry point of a person's page or row: shown only to whoever holds `permission` (the
 * application's catalogue says which one grants it; the server decides again), never for oneself and never while
 * already signed in as somebody else. Afterwards the app is that person's, from the home page, under the banner.
 *
 *   <SignInAsButton :user-id="person.id" :name="person.name" permission="iam.user:impersonate" />
 */
const props = defineProps<{ userId: number; name: string; permission: Permission }>();

const { t } = useI18n();
const platform = usePlatform();
const router = useRouter();
const { home } = useIdentityContext();
const describeError = useDescribeError();
const busy = ref(false);

const available = computed(() => {
  const held = heldSession(platform.session.state.value);
  return held !== null && held.impersonator === undefined && held.user.id !== props.userId;
});

async function signInAsThem() {
  busy.value = true;
  try {
    await signInAs(platform, props.userId);
    await router.push(home);
  } catch (error) {
    toast.error(describeError(error));
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <AccessGate v-if="available" :permission="props.permission">
    <Button :processing="busy" data-sign-in-as @click="signInAsThem">{{ t("core.identity.impersonation.sign_in_as", { name: props.name }) }}</Button>
  </AccessGate>
</template>
