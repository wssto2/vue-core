<script setup lang="ts">
import { computed, ref, useId, useSlots, watch } from "vue";
import { useI18n } from "vue-i18n";
import Button from "../button/Button.vue";
import { Icon, type IconName } from "../icon";
import { useCompactPresentation } from "../internal/mediaQuery";
import { useDialog } from "../overlay/useDialog";
import { useSheetDrag } from "../overlay/useSheetDrag";
import DrawnCheck from "../state/DrawnCheck.vue";
import ProgressTrack from "../state/ProgressTrack.vue";
import { useSheetStack } from "./sheetStack";

/**
 * The adaptive dialog.
 *
 * - Wide screens: a centred dialog on the scrim: title and optional subtitle, a round close
 *   button, the body, and a footer with Cancel and the actions.
 * - Compact (phone, touch-first): a page sheet that slides up almost to the top, with a grabber, a
 *   nav bar (Cancel, title, primary action) and swipe down to dismiss. Swipe, Escape, Cancel and
 *   the close button all go through `beforeDismiss`, so a dirty form is asked about however it is
 *   dismissed.
 *
 * Give the one primary action as `primary-label` and `@primary`: it lands in the footer on desktop
 * and the nav bar on phones. Anything else goes in `#actions` (footer on both). `#header` renders
 * below the title (a step bar, a search).
 *
 *   <Modal ref="modal" :title="t('newLead')" :primary-label="t('create')" grouped
 *          :status="saving ? 'processing' : 'idle'" :before-dismiss="guard" @primary="save">…</Modal>
 *   modal.value?.present()    modal.value?.dismiss()
 *
 * Waiting: `status="processing"` with `processing-label` says what the primary action is doing
 * ("Searching…"); `cancellable-while-processing` keeps Cancel usable for a wait that is safe to
 * abandon (a search, never a save); `progress` draws a hairline along the top; `status="done"` with
 * `done-label` shows "Saved" with a drawn check before the dialog closes.
 *
 * Never open a page sheet above another page sheet except a value sheet that hands one value back;
 * alerts, action sheets and pickers may stack. Initial focus is the first control on wide screens
 * (never the close button) and the panel itself on phones, so no field raises the keyboard before
 * the user taps it. Tab is trapped, the background is inert, focus returns to the trigger.
 */
const props = withDefaults(defineProps<{
  title?: string;
  /** A secondary line under the title ("Step 1 of 3 · Customer"). */
  subtitle?: string;
  /** Wide screens only: 24, 37.5 (the grouped-form dialog), 56 or 72 rem. */
  size?: "sm" | "md" | "lg" | "xl";
  /** The canvas behind grouped rows instead of a plain cell surface. */
  grouped?: boolean;
  /** What the primary action is doing: waiting for an answer, or done. */
  status?: "idle" | "processing" | "done";
  withoutFooter?: boolean;
  /** Hides Cancel and the close button: the flow must offer another way out. */
  withoutCloseButton?: boolean;
  /** The one primary action: a footer button on desktop, a nav bar action on phones. */
  primaryLabel?: string;
  primaryIcon?: IconName;
  primaryDisabled?: boolean;
  /** Asked for every way of dismissing; resolve false to stay open. */
  beforeDismiss?: () => Promise<boolean> | boolean;
  /** Shown on the primary action while `status` is `processing`. */
  processingLabel?: string;
  /** Shown on the primary action once `status` is `done`. */
  doneLabel?: string;
  /** Cancel and the close button stay usable while processing: the wait is safe to abandon. */
  cancellableWhileProcessing?: boolean;
  /** A hairline along the top (0–100); `complete` fills it. Null or undefined draws none. */
  progress?: { value: number; complete?: boolean } | null;
}>(), {
  title: undefined,
  subtitle: undefined,
  size: "lg",
  grouped: false,
  status: "idle",
  withoutFooter: false,
  withoutCloseButton: false,
  primaryLabel: undefined,
  primaryIcon: undefined,
  primaryDisabled: false,
  beforeDismiss: undefined,
  processingLabel: undefined,
  doneLabel: undefined,
  cancellableWhileProcessing: false,
  progress: undefined,
});

// `presented` once the dialog is open and has taken focus; `dismissed` once it has closed,
// however it was closed.
const emit = defineEmits<{ primary: []; presented: []; dismissed: [] }>();

const slots = defineSlots<{
  default?: () => unknown;
  /** Below the title. */
  header?: (scope: { titleId: string; compact: boolean }) => unknown;
  /** Secondary actions, in the footer on both presentations. */
  actions?: () => unknown;
  /** The footer's leading end (a last-saved time). */
  timestamp?: () => unknown;
}>();

const { t } = useI18n();
const allSlots = useSlots();

const panel = ref<HTMLElement | null>(null);
const body = ref<HTMLElement | null>(null);
const titleId = useId();
const isCompact = useCompactPresentation();

const dialog = useDialog(panel, {
  beforeDismiss: () => props.beforeDismiss?.() ?? true,
  initialFocus: () => (isCompact.value ? "panel" : "first"),
  onPresented: () => emit("presented"),
  onDismissed: () => emit("dismissed"),
});
const { isOpen } = dialog;

const drag = useSheetDrag({ enabled: isCompact, panel, body, onDismiss: () => dialog.dismiss() });

// A value sheet above this one: recede, so the stack shows.
const { covered, stacked } = useSheetStack(isOpen);

/** Keeps the teleported wrapper mounted until the panel's leave transition ends. */
const isMounted = ref(false);
// Reopened while the last leave transition was still running: stay mounted.
const unmountIfClosed = () => {
  if (!isOpen.value) isMounted.value = false;
};
watch(isOpen, (open) => {
  if (open) isMounted.value = true;
}, { flush: "sync" });

function present() {
  drag.reset();
  dialog.present();
}

const processing = computed(() => props.status === "processing");
const done = computed(() => props.status === "done");
const hasHeader = computed(() => Boolean(props.title || allSlots.header));
const showCancel = computed(() => !props.withoutCloseButton);
// Nothing to commit (a read-only sheet): the dismiss button closes rather than cancels.
const dismissLabel = computed(() => (props.primaryLabel || allSlots.actions ? t("core.actions.cancel") : t("core.actions.close")));
const primaryBlocked = computed(() => props.primaryDisabled || processing.value || done.value);
const cancelBlocked = computed(() => (processing.value && !props.cancellableWhileProcessing) || done.value);
const primaryText = computed(() => {
  if (done.value && props.doneLabel) return props.doneLabel;
  if (processing.value && props.processingLabel) return props.processingLabel;
  return props.primaryLabel;
});

// Compact: Cancel and the primary action live in the nav bar, so the footer only exists for
// extra actions or a timestamp.
const showFooter = computed(() => {
  if (props.withoutFooter) return false;
  if (!isCompact.value) return true;
  return Boolean(allSlots.actions || allSlots.timestamp);
});

function onPrimary() {
  if (!primaryBlocked.value) emit("primary");
}

const SIZES = { sm: "max-w-sm", md: "max-w-dialog", lg: "max-w-4xl", xl: "max-w-6xl" } as const;

defineExpose({ present, dismiss: async () => dialog.dismiss() });
</script>

<template>
  <Teleport to="body">
    <!-- The stack classes (scale-96, duration-motion-sheet) differ from the enter/leave
         transition's: Vue removes a transition's classes when it ends, a shared one too. -->
    <div v-if="isMounted" class="relative z-9999" :aria-labelledby="hasHeader && props.title ? titleId : undefined" role="dialog" aria-modal="true"
      :data-presentation="isCompact ? 'sheet' : 'dialog'">
      <transition appear enter-active-class="transition-opacity duration-motion-normal ease-motion-standard" enter-from-class="opacity-0"
        leave-active-class="pointer-events-none transition-opacity duration-motion-normal ease-motion-standard" leave-to-class="opacity-0">
        <div v-if="isOpen" class="fixed inset-0 bg-scrim" :style="drag.backdropStyle.value" aria-hidden="true"></div>
      </transition>

      <!-- Compact: page sheet -->
      <transition v-if="isCompact" appear enter-active-class="transition-transform duration-motion-sheet ease-motion-sheet"
        enter-from-class="translate-y-full" leave-active-class="pointer-events-none transition-transform duration-motion-normal ease-motion-standard"
        leave-to-class="translate-y-full" @after-leave="unmountIfClosed">
        <div v-if="isOpen" ref="panel" tabindex="-1" data-part="panel"
          class="fixed inset-x-0 bottom-0 top-[calc(var(--app-safe-top)+0.625rem)] mx-auto flex w-full max-w-readable flex-col overflow-hidden rounded-t-sheet text-content-strong shadow-dialog outline-none"
          :class="[props.grouped ? 'bg-surface-page' : 'bg-surface-cell', drag.dragging.value ? '' : 'transition-transform duration-motion-normal ease-motion-sheet', covered ? 'origin-top scale-95' : '', stacked ? 'translate-y-3' : '']"
          :data-covered="covered || undefined" :style="drag.panelStyle.value">
          <ProgressTrack v-if="props.progress" hairline :value="props.progress.value" :done="props.progress.complete" class="absolute inset-x-0 top-0 z-20" />
          <div class="shrink-0 cursor-grab touch-none select-none" v-bind="drag.handleEvents">
            <div class="flex justify-center pt-1.5" aria-hidden="true">
              <span class="h-1.25 w-9 rounded-full bg-fill-strong"></span>
            </div>
            <div class="grid min-h-bar-height grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-row-inset">
              <div class="flex justify-start">
                <button v-if="showCancel" type="button" :disabled="cancelBlocked" data-part="cancel"
                  class="hit-target -ml-1 cursor-pointer rounded-control px-1 text-body text-content-link disabled:text-content-disabled"
                  @click="dialog.dismiss()">{{ dismissLabel }}</button>
              </div>
              <h2 v-if="props.title" :id="titleId" class="truncate text-center text-headline font-semibold">{{ props.title }}</h2>
              <span v-else></span>
              <div class="flex justify-end">
                <button v-if="props.primaryLabel" type="button" :disabled="primaryBlocked" data-part="primary"
                  class="hit-target -mr-1 flex cursor-pointer items-center gap-1.5 rounded-control px-1 text-body font-semibold text-content-link disabled:cursor-default disabled:text-content-disabled"
                  :aria-busy="processing || undefined" @click="onPrimary">
                  <DrawnCheck v-if="done" :size="15" />
                  <Icon v-else-if="processing" name="loader4Line" :size="16" class="animate-spin" />
                  <span :key="primaryText" class="animate-text-swap">{{ primaryText }}</span>
                </button>
              </div>
            </div>
            <p v-if="props.subtitle" class="-mt-1 px-row-inset pb-1 text-center text-footnote text-content-muted">{{ props.subtitle }}</p>
            <div v-if="slots.header" class="px-screen-padding pt-1 pb-3">
              <slot name="header" :title-id="titleId" :compact="true"></slot>
            </div>
          </div>

          <div ref="body" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-screen-padding pt-2 pb-8" v-bind="drag.bodyEvents">
            <slot></slot>
          </div>

          <div v-if="showFooter"
            class="flex shrink-0 flex-col gap-2 border-t border-border-separator bg-surface-cell px-screen-padding pt-3 pb-[max(0.75rem,var(--app-safe-bottom))]">
            <slot name="actions"></slot>
            <div v-if="slots.timestamp" class="flex items-center justify-center">
              <slot name="timestamp"></slot>
            </div>
          </div>
        </div>
      </transition>

      <!-- Wide: centred dialog. The scrollbar's gutter is reserved on both edges: without it the
           dialog jumped sideways whenever its content grew past the viewport (a dropdown opening,
           a toggle revealing fields) and the scrollbar appeared. -->
      <div v-else class="fixed inset-0 z-10 w-screen overflow-y-auto [scrollbar-gutter:stable_both-edges]" :class="isOpen ? '' : 'pointer-events-none'">
        <div class="flex min-h-full items-center justify-center p-4">
          <transition appear enter-active-class="transition duration-motion-normal ease-motion-standard"
            enter-from-class="opacity-0 scale-95" leave-active-class="pointer-events-none transition duration-motion-fast ease-motion-standard"
            leave-to-class="opacity-0 scale-95" @after-leave="unmountIfClosed">
            <div v-if="isOpen" ref="panel" tabindex="-1" data-part="panel"
              class="relative my-8 w-full rounded-dialog text-left text-content-strong shadow-dialog outline-none transition-transform duration-motion-sheet ease-motion-sheet"
              :class="[SIZES[props.size], props.grouped ? 'bg-surface-page' : 'bg-surface-cell', covered ? '-translate-y-4' : '', stacked ? 'translate-y-4 scale-96' : '']"
              :data-covered="covered || undefined">
              <div v-if="props.progress" class="absolute inset-x-0 top-0 z-20 overflow-hidden rounded-t-dialog">
                <ProgressTrack hairline :value="props.progress.value" :done="props.progress.complete" />
              </div>
              <!-- Sticky header and footer: a tall dialog scrolls in the page-level scroller, and its
                   title and error banner used to scroll away. -->
              <div v-if="hasHeader || showCancel" class="sticky top-0 z-10 flex items-start gap-3 rounded-t-dialog px-5 pt-4.5"
                :class="[hasHeader ? 'pb-3.5' : 'pb-0', props.grouped ? 'bg-surface-page' : 'bg-surface-cell']">
                <div class="flex min-w-0 flex-1 flex-col gap-3.5">
                  <div v-if="props.title" class="flex flex-col gap-0.5">
                    <h2 :id="titleId" class="text-title font-semibold">{{ props.title }}</h2>
                    <p v-if="props.subtitle" class="text-subheadline text-content-muted">{{ props.subtitle }}</p>
                  </div>
                  <slot name="header" :title-id="titleId" :compact="false"></slot>
                </div>
                <button v-if="showCancel" type="button" data-initial-focus-skip :disabled="cancelBlocked"
                  :aria-label="t('core.actions.close')" data-part="close"
                  class="hit-target flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-fill text-content-muted transition-colors duration-motion-fast hover:bg-fill-strong disabled:opacity-45"
                  @click="dialog.dismiss()">
                  <Icon name="close" :size="14" />
                </button>
              </div>

              <div class="px-5 pb-5" :class="hasHeader ? 'pt-1' : 'pt-3'">
                <slot></slot>
              </div>

              <div v-if="showFooter"
                class="sticky bottom-0 z-10 flex flex-row-reverse flex-wrap items-center gap-2.5 rounded-b-dialog border-t border-border-separator bg-surface-cell px-5 py-3.5">
                <span v-if="props.primaryLabel" class="contents" data-part="primary">
                  <Button prominence="primary" :icon="done ? undefined : props.primaryIcon" :processing="processing"
                    :disabled="props.primaryDisabled || done" :class="done ? 'bg-control-on! opacity-100!' : ''" @click="onPrimary">
                    <DrawnCheck v-if="done" :size="16" />
                    <span :key="primaryText" class="animate-text-swap">{{ primaryText }}</span>
                  </Button>
                </span>

                <slot name="actions"></slot>

                <span v-if="showCancel" class="contents" data-part="cancel">
                  <Button prominence="plain" :disabled="cancelBlocked" @click="dialog.dismiss()">{{ dismissLabel }}</Button>
                </span>

                <div class="flex grow items-center">
                  <slot name="timestamp"></slot>
                </div>
              </div>
            </div>
          </transition>
        </div>
      </div>
    </div>
  </Teleport>
</template>
