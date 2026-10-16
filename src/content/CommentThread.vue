<script lang="ts">
export interface CommentItem {
  id: number | string;
  body: string;
  author?: string;
  /** The photo's full URL, built by the app. */
  avatarUrl?: string | null;
  createdAt?: string | null;
  /** Written by the signed-in user: shown on the trailing side. */
  mine?: boolean;
}
</script>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";
import ActivityStream, { type ActivityComment } from "./ActivityStream.vue";
import Composer from "./Composer.vue";

/**
 * The comments of a record: an `ActivityStream` of comment bubbles with a `Composer`. The app maps
 * its rows to `CommentItem`s and owns the calls; this component owns the presentation and the draft.
 *
 *   <CommentThread :comments="comments" :can-add="canManage" :can-remove="canManage"
 *     :on-add="post" @remove="remove" />
 *
 * `onAdd` is a prop so the thread can await it: the draft is cleared once it resolves to anything
 * but `false`, so a failed save (or a refusal after the app's own check) keeps the text.
 */
const props = withDefaults(defineProps<{
  comments: CommentItem[];
  /** Shows the compose box. */
  canAdd?: boolean;
  /** Shows each comment's delete control. */
  canRemove?: boolean;
  /** Greys out compose and delete while the record cannot change. */
  disabled?: boolean;
  title?: string;
  /** Leave the heading out when the container already names the thread (a sheet titled "Notes"). */
  hideTitle?: boolean;
  maxLength?: number;
  /** Saves a new comment with the trimmed text. */
  onAdd?: (text: string) => unknown;
}>(), { canAdd: false, canRemove: false, disabled: false, title: undefined, hideTitle: false, maxLength: 2000, onAdd: undefined });

const emit = defineEmits<{ remove: [comment: CommentItem] }>();

const { t } = useI18n();

const draft = ref("");
const posting = ref(false);

const items = computed<(ActivityComment & { source: CommentItem })[]>(() =>
  props.comments.map((comment) => ({
    kind: "comment",
    id: comment.id,
    at: comment.createdAt ?? null,
    body: comment.body,
    author: comment.author,
    avatarUrl: comment.avatarUrl,
    mine: comment.mine,
    source: comment,
  })),
);

async function submit(text: string) {
  posting.value = true;
  try {
    const saved = await props.onAdd?.(text);
    if (saved !== false) draft.value = "";
  } finally {
    posting.value = false;
  }
}
</script>

<template>
  <section class="flex min-w-0 flex-col gap-3" data-test="comment-thread">
    <h3 v-if="!props.hideTitle" class="px-1 text-subheadline font-semibold text-content-strong compact:text-footnote compact:font-normal compact:uppercase compact:tracking-wide compact:text-content-muted">
      {{ props.title ?? t("core.comments.title") }}
    </h3>

    <p v-if="props.comments.length === 0" class="px-1 text-body text-content-muted" data-test="comment-thread-empty">
      {{ t("core.comments.none") }}
    </p>

    <ActivityStream v-else :items="items" :label="props.title ?? t('core.comments.title')">
      <template #comment-actions="{ item }">
        <button v-if="props.canRemove" type="button" data-test="comment-remove"
          class="hit-target relative inline-flex size-5 cursor-pointer items-center justify-center rounded-full text-content-muted transition-colors duration-motion-fast hover:text-content-destructive focus-visible:outline-2 focus-visible:outline-border-focus disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="props.disabled" :aria-label="t('core.comments.remove')" :title="t('core.comments.remove')"
          @click="emit('remove', item.source)">
          <Icon name="deleteBin2Line" :size="14" />
        </button>
      </template>
    </ActivityStream>

    <Composer v-if="props.canAdd" v-model="draft" :max-length="props.maxLength" :disabled="props.disabled" :processing="posting" @submit="submit" />
  </section>
</template>
