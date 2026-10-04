<script setup lang="ts">
import { ref, useId, watch } from "vue";
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
 *   <Sheet ref="sheet" :title="t('filters')" grouped>…body…<template #footer>…buttons…</template></Sheet>
 *   sheet.value?.present()    sheet.value?.dismiss()
 */
const props = withDefaults(defineProps<{
  title?: string;
  /** The canvas behind inset groups (pickers) instead of a plain cell surface. */
  grouped?: boolean;
}>(), {
  title: undefined,
  grouped: false,
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

/** Keeps the teleported wrapper mounted until the panel's leave transition ends. */
const isMounted = ref(false);
// Reopened while the last leave transition was still running: stay mounted.
const unmountIfClosed = () => {
  if (!isOpen.value) isMounted.value = false;
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

watch(isOpen, (open) => {
  if (open) isMounted.value = true;
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
  dialog.present();
}

function dismiss() {
  dialog.dismissWithoutAsking();
}

defineExpose({ present, dismiss });
</script>

<template>
  <Teleport to="body">
    <div v-if="isMounted" class="relative z-9999" role="dialog" aria-modal="true" :aria-labelledby="props.title ? titleId : undefined">
      <Transition appear enter-active-class="transition-opacity duration-motion-normal ease-motion-standard" enter-from-class="opacity-0"
        leave-active-class="pointer-events-none transition-opacity duration-motion-normal ease-motion-standard" leave-to-class="opacity-0">
        <div v-if="isOpen" class="fixed inset-0 bg-scrim" :style="drag.backdropStyle.value" aria-hidden="true" @click="dismiss" />
      </Transition>

      <Transition appear enter-active-class="transition-transform duration-motion-sheet ease-motion-sheet"
        :enter-from-class="isBottomSheet ? 'translate-y-full' : 'translate-x-full'"
        leave-active-class="pointer-events-none transition-transform duration-motion-normal ease-motion-standard"
        :leave-to-class="isBottomSheet ? 'translate-y-full' : 'translate-x-full'" @after-leave="unmountIfClosed">
        <div v-if="isOpen" ref="panel" tabindex="-1" data-part="panel"
          class="fixed flex flex-col text-content-strong shadow-dialog outline-none"
          :class="[
            props.grouped ? 'bg-surface-page' : 'bg-surface-cell',
            isBottomSheet ? 'inset-x-0 bottom-0 mx-auto max-h-[90dvh] w-full max-w-readable rounded-t-sheet' : 'inset-y-0 right-0 w-full max-w-md',
            drag.dragging.value ? '' : 'transition-transform duration-motion-normal ease-motion-sheet',
          ]"
          :style="drag.panelStyle.value">
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
