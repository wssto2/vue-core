<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "../../button";
import { useFormat } from "../../format";
import { OtpInput } from "../../form";

/**
 * The "enter the code we sent you" step: what was sent where, the boxes for the code, Verify, and "Resend" with the
 * countdown until the server lets another be sent. It knows nothing about what the code is for: the caller passes the
 * server's state in (when the code stops working, when a new one may be asked for) and handles `verify`, `resend` and
 * `cancel`. A wrong code clears the boxes and puts the caret back in the first.
 *
 *   <VerifyCode v-model="code" :description="…" :expires-at="p.expires_at" :resend-available-at="p.resend_available_at"
 *     :error="error" :verifying="busy" @verify="confirm" @resend="resend" @cancel="cancelChange" />
 */
const props = withDefaults(defineProps<{
  description?: string;
  length?: number;
  /** When a new code may be asked for (ISO time). */
  resendAvailableAt?: string | null;
  /** When the code stops working (ISO time). */
  expiresAt?: string | null;
  /** What went wrong with the last attempt, in words. */
  error?: string;
  /** The code can no longer be used: the boxes are off and asking for a new one is the way on. */
  expired?: boolean;
  verifying?: boolean;
  resending?: boolean;
}>(), { description: undefined, length: 6, resendAvailableAt: null, expiresAt: null, error: "", expired: false, verifying: false, resending: false });

const code = defineModel<string>({ default: "" });
const emit = defineEmits<{ verify: [code: string]; resend: []; cancel: [] }>();

const { t } = useI18n();
const format = useFormat();
const errorId = useId();
const otp = useTemplateRef<{ focus: () => void }>("otp");

// The countdown ticks once a second while the step is on screen.
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 1000)));
onBeforeUnmount(() => clearInterval(timer));

const secondsLeft = computed(() => {
  const at = props.resendAvailableAt ? Date.parse(props.resendAvailableAt) : Number.NaN;
  return Number.isNaN(at) ? 0 : Math.max(0, Math.ceil((at - now.value) / 1000));
});
const countdown = computed(() => `${Math.floor(secondsLeft.value / 60)}:${String(secondsLeft.value % 60).padStart(2, "0")}`);
const validUntil = computed(() => (props.expiresAt && !props.expired ? format.time(props.expiresAt) : ""));

const complete = computed(() => code.value.length === props.length);
const busy = computed(() => props.verifying || props.resending);

// The code is handed over as typed: the model has not been read back from the parent yet when the last digit lands.
function verify(typed: string = code.value) {
  if (typed.length === props.length && !busy.value && !props.expired) emit("verify", typed);
}

function resend() {
  if (secondsLeft.value === 0 && !busy.value) emit("resend");
}

watch(() => props.error, (error) => {
  if (!error) return;
  code.value = "";
  otp.value?.focus();
});

defineExpose({ focus: () => otp.value?.focus() });
</script>

<template>
  <form class="flex flex-col items-center text-center" data-verify-code novalidate @submit.prevent="verify()">
    <p v-if="props.description" class="max-w-sm text-body text-content-muted">{{ props.description }}</p>

    <OtpInput ref="otp" v-model="code" class="mt-6" :length="props.length" :invalid="!!props.error" :disabled="props.expired || props.verifying" :described-by="props.error ? errorId : undefined" autofocus
      @complete="verify" />

    <p v-if="props.error" :id="errorId" role="alert" class="mt-3 text-footnote text-content-destructive" data-verify-error>{{ props.error }}</p>
    <p v-else-if="validUntil" class="mt-3 text-footnote text-content-muted" data-verify-expires>{{ t("core.profile.email.valid_until", { time: validUntil }) }}</p>

    <div class="mt-6 flex w-full flex-col gap-2">
      <Button v-if="!props.expired" type="submit" prominence="primary" size="lg" class="w-full justify-center" :disabled="!complete || props.resending" :processing="props.verifying" data-verify-submit>
        {{ t("core.profile.email.verify") }}
      </Button>
      <Button :prominence="props.expired ? 'primary' : 'standard'" size="lg" class="w-full justify-center" :disabled="secondsLeft > 0 || props.verifying" :processing="props.resending" data-verify-resend
        @click="resend">
        <template v-if="secondsLeft > 0">{{ t("core.profile.email.resend_in", { time: countdown }) }}</template>
        <template v-else>{{ props.expired ? t("core.profile.email.request_new") : t("core.profile.email.resend") }}</template>
      </Button>
      <Button prominence="link" class="mt-1 self-center" :disabled="props.verifying" data-verify-cancel @click="emit('cancel')">{{ t("core.profile.email.cancel_change") }}</Button>
    </div>
  </form>
</template>
