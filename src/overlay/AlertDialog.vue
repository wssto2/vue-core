<script setup lang="ts" generic="Subject = undefined">
import { computed, ref, useId, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Icon, type IconName } from "../icon";
import { useCompactPresentation } from "../internal/mediaQuery";
import { useDialog } from "./useDialog";

/**
 * A short question that interrupts: irreversible loss, or a consequential decision. Prefer a
 * toast with Undo when the action can be reversed.
 *
 * - Wide screens: a small centred alert: icon tile, title, message, the safe choice on the left
 *   and the action on the right.
 * - Compact: `presentation="action-sheet"` slides the choices up from the bottom (the critical
 *   choice in red, Cancel set apart) for "discard these changes?" raised by a sheet;
 *   `presentation="alert"` stays a centred alert on phones too, right for an irreversible delete.
 *
 *   <AlertDialog ref="confirm" tone="critical" :title="t('deleteTitle')" :message="t('deleteBody')"
 *                :confirm-label="t('delete')" :action="remove" />
 *   confirm.value?.present(row)
 *
 * `present(subject)` remembers what the question is about and hands it to `action` and to
 * `confirm`. Confirming runs `action` (if any) with the buttons busy; when it succeeds the dialog
 * emits `confirm` and closes; when it throws the dialog stays open and emits `failed`. Escape,
 * the Cancel choice and (action sheet) a tap on the scrim cancel. Label the action with exactly
 * what happens ("Delete", "Discard changes").
 */
const props = withDefaults(defineProps<{
  title: string;
  message?: string;
  /** Says exactly what happens; by default "Confirm". */
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "neutral" | "warning" | "critical";
  icon?: IconName;
  presentation?: "alert" | "action-sheet";
  /** The work the confirmation starts. */
  action?: (subject: Subject) => Promise<void> | void;
}>(), {
  message: undefined,
  confirmLabel: undefined,
  cancelLabel: undefined,
  tone: "neutral",
  icon: undefined,
  presentation: "alert",
  action: undefined,
});

const emit = defineEmits<{
  confirm: [subject: Subject];
  cancel: [];
  /** The action threw; the dialog stays open. */
  failed: [error: unknown];
  /** The dialog closed, however it was closed. */
  dismissed: [];
}>();

defineSlots<{ default?: () => unknown }>();

const { t } = useI18n();

const panel = ref<HTMLElement | null>(null);
const titleId = useId();
const messageId = useId();
const isCompact = useCompactPresentation();
const isActionSheet = computed(() => isCompact.value && props.presentation === "action-sheet");
const isMounted = ref(false);
const busy = ref(false);
let subject = undefined as Subject;

const dialog = useDialog(panel, {
  onEscape: () => cancel(),
  onDismissed: () => emit("dismissed"),
});
const { isOpen } = dialog;

// Reopened while the last leave transition was still running: stay mounted.
const unmountIfClosed = () => {
  if (!isOpen.value) isMounted.value = false;
};

watch(isOpen, (open) => {
  if (open) isMounted.value = true;
}, { flush: "sync" });

function present(about?: Subject) {
  subject = about as Subject;
  dialog.present();
}

function dismiss() {
  dialog.dismissWithoutAsking();
}

function cancel() {
  if (busy.value) return;
  emit("cancel");
  dismiss();
}

async function confirm() {
  if (busy.value) return;
  if (props.action) {
    busy.value = true;
    try {
      await props.action(subject);
    } catch (error) {
      emit("failed", error);
      return;
    } finally {
      busy.value = false;
    }
  }
  emit("confirm", subject);
  dismiss();
}

// A plain question is not a warning: the triangle is for the tones that mean one.
const iconName = computed<IconName>(() => props.icon
  ?? (props.tone === "critical" ? "deleteBin2Line" : props.tone === "neutral" ? "informationLine" : "alertTriangle"));

const TILES = {
  critical: "bg-status-danger-surface text-content-destructive",
  warning: "bg-status-warning-surface text-status-warning-content",
  neutral: "bg-tint-soft text-content-link",
} as const;

const confirmText = computed(() => props.confirmLabel ?? t("core.actions.confirm"));
const cancelText = computed(() => props.cancelLabel ?? t("core.actions.cancel"));

// Two short choices sit side by side; longer ones ("Continue editing") stack, the action on top
// and the safe choice last, instead of wrapping mid-label.
const stacked = computed(() => Math.max(confirmText.value.length, cancelText.value.length) > 12);

defineExpose({ present, dismiss });
</script>

<template>
  <Teleport to="body">
    <div v-if="isMounted" class="relative z-10000" role="alertdialog" aria-modal="true" :aria-labelledby="titleId"
      :aria-describedby="props.message ? messageId : undefined" :data-presentation="isActionSheet ? 'action-sheet' : 'alert'">
      <Transition appear enter-active-class="transition-opacity duration-motion-normal ease-motion-standard" enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-motion-normal ease-motion-standard" leave-to-class="opacity-0">
        <div v-if="isOpen" class="fixed inset-0 bg-scrim" aria-hidden="true" @click="isActionSheet ? cancel() : undefined" />
      </Transition>

      <!-- Compact action sheet -->
      <Transition v-if="isActionSheet" appear enter-active-class="transition-transform duration-motion-sheet ease-motion-sheet"
        enter-from-class="translate-y-[120%]" leave-active-class="transition-transform duration-motion-normal ease-motion-standard"
        leave-to-class="translate-y-[120%]" @after-leave="unmountIfClosed">
        <div v-if="isOpen" ref="panel" tabindex="-1"
          class="fixed inset-x-2 bottom-[max(0.5rem,var(--app-safe-bottom))] mx-auto flex max-w-md flex-col gap-2 outline-none">
          <div class="overflow-hidden rounded-menu bg-surface-overlay/95 backdrop-blur-xl">
            <div class="flex flex-col gap-1 px-4 py-3.5 text-center">
              <h2 :id="titleId" class="text-footnote font-semibold text-content-muted">{{ props.title }}</h2>
              <p v-if="props.message" :id="messageId" class="text-footnote text-content-muted">{{ props.message }}</p>
              <slot />
            </div>
            <button type="button" data-action="confirm" :disabled="busy"
              class="flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 border-t border-border-separator px-4 text-headline active:bg-fill disabled:opacity-45"
              :class="props.tone === 'critical' ? 'text-content-destructive' : 'text-content-link'" @click="confirm">
              <Icon v-if="busy" name="loader4Line" :size="20" class="animate-spin" />
              {{ confirmText }}
            </button>
          </div>
          <button type="button" data-action="cancel" :disabled="busy"
            class="min-h-14 w-full cursor-pointer rounded-menu bg-surface-cell px-4 text-headline font-semibold text-content-link active:bg-fill disabled:opacity-45"
            @click="cancel">
            {{ cancelText }}
          </button>
        </div>
      </Transition>

      <!-- Alert -->
      <div v-else class="fixed inset-0 flex items-center justify-center p-4" :class="isOpen ? '' : 'pointer-events-none'">
        <Transition appear enter-active-class="transition duration-motion-normal ease-motion-standard" enter-from-class="opacity-0 scale-105"
          leave-active-class="transition duration-motion-fast ease-motion-standard" leave-to-class="opacity-0"
          @after-leave="unmountIfClosed">
          <div v-if="isOpen" ref="panel" tabindex="-1"
            class="flex w-full max-w-[19rem] flex-col items-center gap-2.5 rounded-menu bg-surface-overlay/95 px-4.5 pt-5 pb-4 text-center shadow-float outline-none backdrop-blur-xl compact:max-w-[17rem]">
            <span class="flex size-11 items-center justify-center rounded-group" :class="TILES[props.tone]" aria-hidden="true">
              <Icon :name="iconName" :size="22" />
            </span>
            <h2 :id="titleId" class="text-headline font-semibold text-content-strong">{{ props.title }}</h2>
            <p v-if="props.message" :id="messageId" class="whitespace-pre-line text-footnote text-content-muted">{{ props.message }}</p>
            <slot />
            <div class="mt-1.5 grid w-full gap-2" :class="stacked ? 'grid-cols-1' : 'grid-cols-2'">
              <button type="button" data-action="cancel" :disabled="busy" :class="stacked ? 'order-last' : ''"
                class="hit-target min-h-8 cursor-pointer rounded-control bg-fill px-3 py-1.5 text-subheadline font-semibold text-content-strong transition-colors duration-motion-fast hover:bg-fill-strong disabled:opacity-45"
                @click="cancel">
                {{ cancelText }}
              </button>
              <button type="button" data-action="confirm" :disabled="busy"
                class="hit-target flex min-h-8 cursor-pointer items-center justify-center gap-1.5 rounded-control px-3 py-1.5 text-subheadline font-semibold transition duration-motion-fast hover:brightness-110 disabled:opacity-45"
                :class="props.tone === 'critical' ? 'bg-status-danger-solid text-white' : 'bg-tint text-content-on-tint'"
                @click="confirm">
                <Icon v-if="busy" name="loader4Line" :size="14" class="animate-spin" />
                {{ confirmText }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </Teleport>
</template>
