<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { Icon } from "../icon";
import { BottomDockPortal } from "../page";
import { useBackgroundTasks } from "./backgroundTasks";
import DrawnCheck from "./DrawnCheck.vue";

/**
 * The capsule that follows work the user left (UI decision D23, MOTION_PLAN M2): pinned above the
 * bottom edge (in the bottom dock), it shows a running task (spinner, what it is, what it is
 * doing, the seconds) and, when it ends, turns into "… is ready · Open" (or the failure, with the
 * same way back). It goes away on Open, on the close button, or by itself `hideAfterMs` after the
 * end. A page that shows the task in place hides it (`useBackgroundTasks().watchTask`). Render it
 * once in the shell, where `installBackgroundTasks(app)` has been called.
 *
 *   <BackgroundTaskCapsule />
 */
const props = withDefaults(defineProps<{
  /** How long an ended task stays, so it can be read and acted on. */
  hideAfterMs?: number;
}>(), { hideAfterMs: 12000 });

const { t } = useI18n();
const router = useRouter();
const store = useBackgroundTasks();
const task = store.unwatched;

const now = ref(Date.now());
const tick = setInterval(() => (now.value = Date.now()), 1000);
const seconds = computed(() => (task.value ? Math.max(0, Math.floor((now.value - task.value.startedAt) / 1000)) : 0));

let hideTimer: ReturnType<typeof setTimeout> | null = null;
watch(() => [task.value?.id, task.value?.status] as const, ([id, status]) => {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = null;
  if (id && status && status !== "running") hideTimer = setTimeout(() => store.dismiss(id), props.hideAfterMs);
});
onBeforeUnmount(() => {
  clearInterval(tick);
  if (hideTimer) clearTimeout(hideTimer);
});

function open() {
  const current = task.value;
  if (!current) return;
  store.dismiss(current.id);
  void router.push(current.route);
}
</script>

<template>
  <BottomDockPortal>
    <Transition enter-active-class="transition duration-motion-sheet ease-motion-sheet" enter-from-class="translate-y-6 scale-95 opacity-0"
      leave-active-class="transition duration-motion-normal ease-motion-standard" leave-to-class="translate-y-4 opacity-0">
      <div v-if="task" class="dock-safe-area pointer-events-auto order-first mb-3 flex justify-center px-3" data-test="background-task"
        :data-status="task.status">
        <div class="flex min-h-13 w-full max-w-md items-center gap-3 rounded-full bg-surface-inverse py-1.5 pr-1.5 pl-4 text-content-inverse shadow-float"
          role="status" aria-live="polite">
          <Icon v-if="task.status === 'running'" name="loader4Line" :size="18" class="shrink-0 animate-spin text-content-inverse-accent" />
          <span v-else-if="task.status === 'done'" class="flex size-6 shrink-0 animate-pop items-center justify-center rounded-full bg-control-on text-white">
            <DrawnCheck :size="13" />
          </span>
          <Icon v-else name="errorWarningLine" :size="18" class="shrink-0 text-content-inverse-danger" />

          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-subheadline font-semibold" data-test="background-task-title">
              {{ task.status === 'running' ? task.title : task.status === 'done' ? task.doneTitle : task.failedTitle }}
            </span>
            <span :key="`${task.status}:${task.outcome ?? task.detail}`" class="truncate text-footnote opacity-80 animate-text-swap">
              {{ task.status === 'running' ? task.detail : task.outcome ?? task.title }}
            </span>
          </span>

          <span v-if="task.status === 'running'" class="shrink-0 pr-3 text-footnote tabular-nums opacity-80">{{ t("core.wait.seconds", { count: seconds }) }}</span>
          <template v-else>
            <button type="button" class="hit-target shrink-0 cursor-pointer rounded-full bg-content-inverse-accent px-4 py-2 text-subheadline font-semibold text-surface-inverse"
              data-test="background-task-open" @click="open">{{ t("core.actions.open") }}</button>
            <button type="button" class="hit-target flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-content-inverse opacity-70"
              :aria-label="t('core.actions.close')" data-test="background-task-dismiss" @click="store.dismiss(task.id)">
              <Icon name="close" :size="14" />
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </BottomDockPortal>
</template>
