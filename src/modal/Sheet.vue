<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";
import { useMediaQuery } from "../internal/mediaQuery";
import { useDialog } from "../overlay/useDialog";
import { useSheetDrag } from "../overlay/useSheetDrag";

/**
 * A side panel that adapts to the device: lists, pickers, filters, a quick look. Use a `Modal` for
 * forms (a page sheet on phones).
 *
 * - Desktop (wide viewport, fine pointer): a slide-over pinned to the right edge, full height.
 * - Phone, tablet or any coarse pointer: a bottom sheet capped at 90 % of the viewport whose body
 *   scrolls on its own and which can be dragged down to dismiss: from the grabber or header at any
 *   time, and from the body once it is scrolled to the top (a downward swipe scrolls content first,
 *   as in a native sheet).
 *
 * Inertness, scroll lock, Escape and focus come from `useDialog`, the behaviour Modal and
 * AlertDialog use, so they nest.
 *
 * - `size` (`md` 28rem, the default; `lg` 36rem; `xl` 48rem) is the width of the desktop slide-over; the bottom sheet ignores it.
 * - `docked` makes the desktop sheet a **non-modal** panel in the page's own layout: no scrim, no scroll lock, no focus trap, the
 *   page beside it stays usable (inert nothing), and its content narrows to make room. Put the sheet as a child of a flex row
 *   next to the content (`<div class="flex h-full"><div class="min-w-0 flex-1">page</div><Sheet docked …/></div>`); it takes the
 *   row's height. Escape closes it while focus is inside it. On phones, tablets and touch screens a docked sheet is the usual
 *   bottom sheet, because there is no room beside the page.
 *
 *   <Sheet ref="sheet" :title="t('filters')" grouped>…body…<template #footer>…buttons…</template></Sheet>
 *   sheet.value?.present()    sheet.value?.dismiss()
 */
const props = withDefaults(defineProps<{
  title?: string;
  /** The canvas behind inset groups (pickers) instead of a plain cell surface. */
  grouped?: boolean;
  /** The width of the desktop slide-over. */
  size?: "md" | "lg" | "xl";
  /** A non-modal panel beside the page (desktop only); see above. */
  docked?: boolean;
}>(), {
  title: undefined,
  grouped: false,
  size: "md",
  docked: false,
});

const emit = defineEmits<{ presented: []; dismissed: [] }>();

defineSlots<{
  default?: () => unknown;
  footer?: () => unknown;
  /** Replaces the title and the close button (a picker's Clear, title and Done); give the title element `titleId` so the dialog is named by it. The grabber stays. */
  header?: (scope: { titleId: string }) => unknown;
  /** Buttons in the default header, just before the close button (an inbox's settings gear). */
  actions?: () => unknown;
}>();

const { t } = useI18n();

const isBottomSheet = useMediaQuery("(max-width: 1023px), (pointer: coarse)");
const docked = computed(() => props.docked && !isBottomSheet.value);
const SIZES = { md: "max-w-md", lg: "max-w-xl", xl: "max-w-3xl" } as const;
const DOCKED_SIZES = { md: "w-md", lg: "w-xl", xl: "w-3xl" } as const;

/** Keeps the teleported wrapper mounted until the panel's leave transition ends. */
const isMounted = ref(false);
// Reopened while the last leave transition was still running: stay mounted.
const unmountIfClosed = () => {
  if (!open.value) isMounted.value = false;
};
const panel = ref<HTMLElement | null>(null);
const body = ref<HTMLElement | null>(null);
const titleId = useId();

const dialog = useDialog(panel, {
  initialFocus: "panel",
  onPresented: () => emit("presented"),
  onDismissed: () => emit("dismissed"),
});
const { isOpen } = dialog;
// A docked sheet has no dialog behind it: no stack, no inertness, no trap.
const dockedOpen = ref(false);
let opener: HTMLElement | null = null;
const open = computed(() => (docked.value ? dockedOpen.value : isOpen.value));

watch(open, (value) => {
  if (value) isMounted.value = true;
}, { flush: "sync" });

const drag = useSheetDrag({
  enabled: isBottomSheet,
  panel,
  body,
  onDismiss: () => {
    dialog.dismissWithoutAsking();
    return true;
  },
});

function present() {
  drag.reset();
  if (!docked.value) return dialog.present();
  if (dockedOpen.value) return;
  opener = document.activeElement as HTMLElement | null;
  dockedOpen.value = true;
  void nextTick(() => {
    panel.value?.focus({ preventScroll: true });
    emit("presented");
  });
}

function dismiss() {
  if (!docked.value) return dialog.dismissWithoutAsking();
  if (!dockedOpen.value) return;
  dockedOpen.value = false;
  emit("dismissed");
  if (opener?.isConnected) opener.focus();
  opener = null;
}

// Non-modal: Escape counts only while focus is inside (a popover that used it first says so with preventDefault).
function onPanelKeydown(event: KeyboardEvent) {
  if (docked.value && event.key === "Escape" && !event.defaultPrevented) {
    event.preventDefault();
    dismiss();
  }
}

defineExpose({ present, dismiss });
</script>

<template>
  <Teleport to="body" :disabled="docked">
    <div v-if="isMounted" :class="docked ? 'flex h-full min-h-0 shrink-0 ' + DOCKED_SIZES[props.size] + ' max-w-full' : 'relative z-9999'" :data-docked="docked || undefined"
      :role="docked ? 'region' : 'dialog'" :aria-modal="docked ? undefined : 'true'" :aria-labelledby="props.title ? titleId : undefined">
      <Transition v-if="!docked" appear enter-active-class="transition-opacity duration-motion-normal ease-motion-standard" enter-from-class="opacity-0"
        leave-active-class="pointer-events-none transition-opacity duration-motion-normal ease-motion-standard" leave-to-class="opacity-0">
        <div v-if="open" class="fixed inset-0 bg-scrim" :style="drag.backdropStyle.value" aria-hidden="true" @click="dismiss" />
      </Transition>

      <Transition appear enter-active-class="transition-transform duration-motion-sheet ease-motion-sheet"
        :enter-from-class="docked ? 'opacity-0' : isBottomSheet ? 'translate-y-full' : 'translate-x-full'"
        leave-active-class="pointer-events-none transition-transform duration-motion-normal ease-motion-standard"
        :leave-to-class="docked ? 'opacity-0' : isBottomSheet ? 'translate-y-full' : 'translate-x-full'" @after-leave="unmountIfClosed">
        <div v-if="open" ref="panel" tabindex="-1" data-part="panel"
          class="flex flex-col text-content-strong outline-none"
          :class="[
            props.grouped ? 'bg-surface-page' : 'bg-surface-cell',
            docked ? 'relative h-full w-full border-l border-border-separator' : 'fixed shadow-dialog',
            docked ? '' : isBottomSheet ? 'inset-x-0 bottom-0 mx-auto max-h-[90dvh] w-full max-w-readable rounded-t-sheet' : 'inset-y-0 right-0 w-full ' + SIZES[props.size],
            drag.dragging.value ? '' : 'transition-transform duration-motion-normal ease-motion-sheet',
          ]"
          :style="drag.panelStyle.value" @keydown="onPanelKeydown">
          <div class="shrink-0" :class="isBottomSheet ? 'cursor-grab touch-none select-none' : ''" v-bind="drag.handleEvents">
            <div v-if="isBottomSheet" class="flex justify-center pt-1.5" aria-hidden="true">
              <span class="h-1.25 w-9 rounded-full bg-fill-strong" />
            </div>

            <slot name="header" :title-id="titleId">
              <div class="flex min-h-bar-height items-center justify-between gap-3 px-4" :class="isBottomSheet ? 'pb-1' : 'border-b border-border-separator'">
                <h3 v-if="props.title" :id="titleId" class="text-headline font-semibold">{{ props.title }}</h3>
                <div class="ml-auto flex items-center gap-1">
                  <slot name="actions" />
                  <button type="button" data-part="close" :aria-label="t('core.actions.close')"
                    class="hit-target -mr-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-fill text-content-muted transition-colors duration-motion-fast hover:bg-fill-strong"
                    @click="dismiss">
                    <Icon name="close" :size="14" />
                  </button>
                </div>
              </div>
            </slot>
          </div>

          <div ref="body" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" v-bind="drag.bodyEvents">
            <slot />
          </div>

          <div v-if="$slots.footer" class="shrink-0 border-t border-border-separator bg-surface-cell px-4 pt-3 pb-[max(0.75rem,var(--app-safe-bottom))]">
            <slot name="footer" />
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>
