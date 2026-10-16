<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";

/**
 * "Add the application to your home screen" on iPhone. Safari gives pages no install API and no
 * view of its menus, so the card shows the three taps in turn (the more button at the bottom
 * right, Share, Add to Home Screen), advancing on its own and on Next, with an arrow at the more
 * button for the first. `close` fires when the user closes it; the application keeps it closed.
 *
 *   <IosInstallGuide v-if="currentPlatform() === 'ios' && !dismissed" app-name="Helpdesk" @close="dismissed = true" />
 */
const props = defineProps<{
  appName: string;
  /** The tile's letters; the first three of the name by default. */
  badge?: string;
}>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const step = ref(0);
const STEPS = ["more", "share", "add"] as const;
let timer: ReturnType<typeof setInterval> | null = null;

const stop = () => { if (timer) clearInterval(timer); timer = null; };
const start = () => {
  stop();
  timer = setInterval(() => { step.value = (step.value + 1) % STEPS.length; }, 2800);
};
const next = () => { step.value = (step.value + 1) % STEPS.length; start(); };
const current = computed(() => STEPS[step.value]!);

onMounted(start);
onBeforeUnmount(stop);
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-0 z-50" data-test="install-ios-guide">
      <div class="pointer-events-auto absolute inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] flex animate-reveal flex-col gap-2.5 rounded-2xl bg-surface-cell px-4 py-3.5 shadow-dialog">
        <div class="flex items-center gap-3">
          <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-tint text-footnote font-semibold text-content-on-tint">{{ props.badge ?? props.appName.slice(0, 3).toUpperCase() }}</span>
          <span class="flex flex-1 flex-col">
            <span class="text-body font-semibold text-content-strong">{{ t("core.pwa.ios.title", { app: appName }) }}</span>
            <span class="text-footnote text-content-muted">{{ t("core.pwa.ios.subtitle") }}</span>
          </span>
          <button type="button" class="hit-target grid size-7 place-items-center rounded-full bg-fill text-content-muted" :aria-label="t('core.actions.close')"
            data-test="install-ios-guide-close" @click="emit('close')">
            <Icon name="close" :size="12" />
          </button>
        </div>
        <div class="flex items-center gap-2.5 border-t border-border-separator pt-2.5">
          <span class="grid size-6 shrink-0 place-items-center rounded-full bg-tint text-footnote font-semibold text-content-on-tint">{{ step + 1 }}</span>
          <span :key="current" class="flex-1 animate-text-swap text-subheadline font-semibold text-content-strong" aria-live="polite">{{ t(`core.pwa.ios.steps.${current}`) }}</span>
          <span class="flex gap-1" aria-hidden="true">
            <span v-for="(_, i) in STEPS" :key="i" class="h-1.5 rounded-full transition-[width,background-color] duration-motion-normal"
              :class="[i === step ? 'w-4' : 'w-1.5', i <= step ? 'bg-tint' : 'bg-fill-strong']" />
          </span>
          <button type="button" class="text-subheadline font-semibold text-content-link" @click="next">{{ t("core.pwa.ios.next") }}</button>
        </div>
      </div>
      <!-- Step 1: the more button sits bottom right in Safari's bar. -->
      <span v-if="current === 'more'" class="absolute right-5 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] grid size-10 animate-bounce place-items-center rounded-full bg-tint text-content-on-tint shadow-dialog" aria-hidden="true">
        <Icon name="arrowDownSLine" class="size-5" />
      </span>
    </div>
  </Teleport>
</template>
