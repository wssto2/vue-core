<script setup lang="ts">
import { ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { isApiError } from "../../client";
import { FormView, TextField, useForm, useLeaveGuard, type FormValidator } from "../../form";
import { Modal } from "../../modal";
import type { PendingEmail, ProfileResponse } from "../../modules/identity/entities";
import { identityRoutes } from "../../modules/identity/routes";
import { toast } from "../../overlay";
import { usePlatform } from "../../platform";
import { useServerMessages } from "../fieldMessages";
import { isSessionEnded } from "../signIn";
import VerifyCode from "./VerifyCode.vue";

/**
 * Changing the e-mail address takes two steps: the new address with the current password, then the code mailed to that
 * address. Closing the dialog keeps a pending change (the profile offers to resume or cancel it). A code that no longer
 * works (expired, too many wrong attempts) says so and offers a new one; an address taken in the meantime sends the person
 * back to the first step with the reason on the field.
 */
const emit = defineEmits<{ pending: [pending: PendingEmail | null]; changed: [profile: ProfileResponse]; cancelled: [] }>();

const { t } = useI18n();
const { http } = usePlatform();
const messages = useServerMessages();

const modal = useTemplateRef<{ present: () => void; dismiss: () => void }>("modal");
const step = ref<"request" | "verify">("request");
const pending = ref<PendingEmail | null>(null);
const open = ref(false);

const validator: FormValidator<{ email: string; current_password: string }> = {
  safeParse(input) {
    const { email, password } = input as { email: string; password: string };
    const required = t("core.account.validation.required");
    const issues = [...(email.trim() === "" ? [{ path: ["email"], message: required }] : []), ...(password === "" ? [{ path: ["password"], message: required }] : [])];
    return issues.length > 0 ? { success: false, error: { issues } } : { success: true, data: { email: email.trim(), current_password: password } };
  },
};
const form = useForm({ ...messages, defaults: () => ({ email: "", password: "" }), validator, serverField: (field) => (field === "current_password" ? "password" : field) });
const { confirmDiscard } = useLeaveGuard(() => open.value && step.value === "request" && form.dirty.value);

const code = ref("");
const codeError = ref("");
const expired = ref(false);
const verifying = ref(false);
const resending = ref(false);
const cancelling = ref(false);

const EXHAUSTED = ["identity.code.expired", "identity.code.too_many_attempts", "identity.code.no_pending"];

function clearCode() {
  code.value = "";
  codeError.value = "";
  expired.value = false;
}

function present(existing: PendingEmail | null) {
  pending.value = existing;
  step.value = existing ? "verify" : "request";
  form.hydrate({ email: "", password: "" });
  clearCode();
  modal.value?.present();
}

async function request() {
  const result = await form.submit(async (payload) => (await http.request(identityRoutes.profileRequestEmail, payload)).data);
  if (result.status !== "saved") return;
  pending.value = result.value;
  clearCode();
  step.value = "verify";
  emit("pending", result.value);
}

async function verify(value: string) {
  if (verifying.value) return;
  verifying.value = true;
  codeError.value = "";
  try {
    const profile = (await http.request(identityRoutes.profileConfirmEmail, { code: value })).data;
    emit("changed", profile);
    toast.success(t("core.profile.email.changed"));
    modal.value?.dismiss();
  } catch (error) {
    if (isSessionEnded(error)) return;
    // The address was taken between the request and the code: the code is used up, so start again with the reason on the field.
    if (isApiError(error) && error.fields.email?.[0]) {
      pending.value = null;
      emit("pending", null);
      step.value = "request";
      form.errors.set({ email: [messages.describeFieldError(error.fields.email[0])] });
      return;
    }
    expired.value = isApiError(error) && error.code !== null && EXHAUSTED.includes(error.code);
    codeError.value = messages.sentence(error, t("core.profile.email.verify_failed"));
  } finally {
    verifying.value = false;
  }
}

async function resend() {
  if (resending.value) return;
  resending.value = true;
  try {
    pending.value = (await http.request(identityRoutes.profileResendEmail)).data;
    clearCode();
    emit("pending", pending.value);
    toast.success(t("core.profile.email.code_sent", { email: pending.value.email }));
  } catch (error) {
    if (isSessionEnded(error)) return;
    if (isApiError(error) && error.code === "identity.code.no_pending") {
      pending.value = null;
      emit("pending", null);
      step.value = "request";
      return;
    }
    codeError.value = messages.sentence(error, t("core.profile.email.resend_failed"));
  } finally {
    resending.value = false;
  }
}

async function cancelChange() {
  if (cancelling.value) return;
  cancelling.value = true;
  try {
    await http.request(identityRoutes.profileCancelEmail);
    pending.value = null;
    emit("cancelled");
    toast.success(t("core.profile.email.cancelled"));
    modal.value?.dismiss();
  } catch (error) {
    if (!isSessionEnded(error)) toast.error(messages.sentence(error, t("core.profile.email.cancel_failed")));
  } finally {
    cancelling.value = false;
  }
}

defineExpose({ present });
</script>

<template>
  <Modal ref="modal" size="md" :title="step === 'request' ? t('core.profile.email.change_title') : t('core.profile.email.verify_title')" :primary-label="step === 'request' ? t('core.profile.email.send_code') : undefined"
    :without-footer="step === 'verify'" :status="form.submitting.value ? 'processing' : 'idle'" :before-dismiss="confirmDiscard" @primary="request" @presented="open = true" @dismissed="open = false">
    <FormView v-if="step === 'request'" :form="form" @submit="request">
      <p class="text-body text-content-muted">{{ t("core.profile.email.request_hint") }}</p>
      <TextField v-bind="form.bind('email')" :label="t('core.profile.email.new_email')" type="email" required autocomplete="email" />
      <TextField v-bind="form.bind('password')" :label="t('core.profile.email.current_password')" type="password" required autocomplete="current-password" />
    </FormView>
    <div v-else class="px-2 py-4 sm:px-6">
      <VerifyCode v-model="code" :description="t('core.profile.email.verify_description', { email: pending?.email ?? '' })" :resend-available-at="pending?.resend_available_at ?? null"
        :expires-at="pending?.expires_at ?? null" :error="codeError" :expired="expired" :verifying="verifying" :resending="resending" @verify="verify" @resend="resend" @cancel="cancelChange" />
    </div>
  </Modal>
</template>
