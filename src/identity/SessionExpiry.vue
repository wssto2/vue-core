<script setup lang="ts">
import { computed, ref, useId, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { Button } from "../button";
import { FormView, TextField, useLeaveGuardContext } from "../form";
import { Icon } from "../icon";
import { useCompactPresentation } from "../internal/mediaQuery";
import { useDescribeError } from "../i18n";
import { toast } from "../overlay";
import { useDialog } from "../overlay/useDialog";
import { usePlatform } from "../platform";
import { useSignInForm } from "./useSignInForm";

/**
 * The prompt of a session that ended in the middle of work: the page stays where it is behind a scrim (inert, so a
 * form keeps its draft), and a dialog (wide screens) or a bottom sheet (phones) asks for the password again. The
 * login is fixed to the person whose page it is. It cannot be dismissed (Escape does nothing): the person signs in,
 * or chooses to sign out, which asks the unsaved-changes question first, as any leave does.
 */
const { t } = useI18n();
const { session } = usePlatform();
const route = useRoute();
const leaveGuard = useLeaveGuardContext();
const describeError = useDescribeError();
const compact = useCompactPresentation();
const titleId = useId();

// Who the page belongs to: the session that expired (kept by `holdsExpiredSession`).
const login = computed(() => {
  const state = session.state.value;
  const user = state.status === "anonymous" && state.reason === "expired" ? (state.previous?.user as { login?: unknown } | undefined) : undefined;
  return typeof user?.login === "string" ? user.login : null;
});
const wanted = computed(() => login.value !== null && route.meta.public !== true);

const panel = ref<HTMLElement | null>(null);
const dialog = useDialog(panel, { onEscape: () => undefined });
const { isOpen } = dialog;

const { form, passwordError, submit } = useSignInForm({ login: login.value ?? "" });

watch(wanted, (open) => {
  if (open) {
    form.hydrate({ login: login.value ?? "", password: "" });
    dialog.present();
  } else dialog.dismissWithoutAsking();
}, { immediate: true, flush: "post" });

async function signOut() {
  if (leaveGuard.hasUnsavedChanges() && !(await leaveGuard.confirm())) return;
  try {
    await session.signOut();
  } catch (error) {
    toast.error(describeError(error)); // the session ended here; the server did not confirm it
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="relative z-10000" role="alertdialog" aria-modal="true" :aria-labelledby="titleId" data-session-expiry>
      <div class="fixed inset-0 bg-scrim" aria-hidden="true" />
      <div class="fixed inset-0 flex p-4" :class="compact ? 'items-end p-0' : 'items-center justify-center'">
        <div ref="panel" tabindex="-1"
          class="flex w-full flex-col gap-4 bg-surface-overlay p-6 shadow-float outline-none"
          :class="compact ? 'rounded-t-2xl pb-[max(2rem,var(--app-safe-bottom))]' : 'max-w-sm rounded-menu'">
          <div>
            <h2 :id="titleId" class="text-headline font-semibold text-content-strong">{{ t("core.identity.expired.title") }}</h2>
            <p class="mt-1 text-subheadline text-content-muted">{{ t("core.identity.expired.body") }}</p>
          </div>
          <p class="flex items-center gap-2 rounded-control bg-status-success-surface px-2.5 py-2 text-footnote text-status-success-content">
            <Icon name="checkboxCircleFill" :size="16" class="shrink-0" />
            {{ t("core.identity.expired.kept") }}
          </p>
          <FormView @submit="submit">
            <div class="flex flex-col gap-1.5">
              <span class="text-footnote text-content-muted">{{ t("core.identity.signin.login") }}</span>
              <span class="rounded-control bg-fill px-2.5 py-2 text-body text-content-muted" data-expiry-login>{{ login }}</span>
            </div>
            <TextField v-bind="form.bind('password')" :label="t('core.identity.signin.password')" type="password" autocomplete="current-password" required
              :error="passwordError" />
            <Button type="submit" prominence="primary" class="w-full" :processing="form.submitting.value">{{ t("core.identity.signin.submit") }}</Button>
          </FormView>
          <Button prominence="plain" class="self-center" @click="signOut">{{ t("core.identity.expired.sign_out") }}</Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
