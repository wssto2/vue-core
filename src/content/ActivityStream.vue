<script lang="ts">
import type { IconName } from "../icon";
import type { Tone } from "../state";

/** Something that happened to the record: an assignment, a phase change. */
export interface ActivityEvent {
  kind: "event";
  id: string | number;
  at: string | null;
  icon: IconName;
  tone?: Tone;
  /** Who did it (shown in the meta line). */
  actor?: string | null;
  /** Plain text; use the `#event` slot for badges or details. */
  text?: string;
}

/** A comment someone wrote. `mine` puts it on the trailing side. */
export interface ActivityComment {
  kind: "comment";
  id: string | number;
  at: string | null;
  body: string;
  author?: string | null;
  /** The photo's full URL, built by the app; initials show until it loads or without it. */
  avatarUrl?: string | null;
  mine?: boolean;
}

export type ActivityItem = ActivityEvent | ActivityComment;
</script>

<script setup lang="ts" generic="T extends ActivityItem">
import { computed } from "vue";
import { toDate, useFormat } from "../format";
import { Icon } from "../icon";
import Avatar from "./Avatar.vue";

/**
 * Events and comments in one chronological stream. Oldest first, so the newest entry sits next to
 * the composer; entries are grouped under day separators ("Today", "Yesterday", a date).
 *
 *   <ActivityStream :items="items">
 *     <template #event="{ item }"><PhaseBadge :phase="item.phase" /></template>
 *   </ActivityStream>
 *
 * Events are one quiet line: a tone circle with an icon, the text, and "who · when". Comments are
 * bubbles: other people on the leading side with their photo (initials as fallback), your own on the
 * trailing side in the selected tint. The app maps its records to items and owns every call.
 */
const props = withDefaults(defineProps<{
  items: T[];
  /** Label of the list for assistive technology. */
  label?: string;
}>(), {
  label: undefined,
});

defineSlots<{
  /** Event content (defaults to `item.text`). */
  event?: (props: { item: Extract<T, { kind: "event" }> }) => unknown;
  /** Extra context in a comment's meta line (the phase it was written in). */
  "comment-meta"?: (props: { item: Extract<T, { kind: "comment" }> }) => unknown;
  /** Extra controls in a comment's meta line (delete). */
  "comment-actions"?: (props: { item: Extract<T, { kind: "comment" }> }) => unknown;
}>();

const format = useFormat();

// Written out in full so Tailwind generates every class.
const TONES = {
  neutral: "bg-status-neutral-surface text-status-neutral-content",
  info: "bg-status-info-surface text-status-info-content",
  warning: "bg-status-warning-surface text-status-warning-content",
  critical: "bg-status-danger-surface text-status-danger-content",
  positive: "bg-status-success-surface text-status-success-content",
} as const;

const time = (item: ActivityItem): number => toDate(item.at)?.getTime() ?? 0;

const days = computed(() => {
  const sorted = props.items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => time(a.item) - time(b.item) || a.index - b.index)
    .map(({ item }) => item);

  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const item of sorted) {
    const key = time(item) > 0 ? new Date(item.at!).toDateString() : "";
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: format.day(item.at), items: [item] });
  }
  return groups;
});

const meta = (who: string | null | undefined, at: string | null): string => [who, format.time(at)].filter(Boolean).join(" · ");

const asEvent = (item: T) => item as Extract<T, { kind: "event" }>;
const asComment = (item: T) => item as Extract<T, { kind: "comment" }>;
</script>

<template>
  <div data-test="activity-stream" class="flex min-w-0 flex-col gap-3.5 compact:gap-3" :aria-label="props.label" role="group">
    <section v-for="day in days" :key="day.key" class="flex min-w-0 flex-col gap-3.5 compact:gap-3">
      <h4 v-if="day.label" class="py-1.5 text-center text-caption font-semibold text-content-muted" data-test="activity-day">
        {{ day.label }}
      </h4>

      <ol class="flex min-w-0 flex-col gap-3.5 compact:gap-3">
        <li v-for="item in day.items" :key="`${item.kind}-${item.id}`" class="min-w-0">
          <div v-if="item.kind === 'event'" data-test="activity-event" class="flex min-w-0 items-center gap-2.5 py-0.5 compact:items-start">
            <span aria-hidden="true" class="flex size-7 shrink-0 items-center justify-center rounded-full" :class="TONES[asEvent(item).tone ?? 'neutral']">
              <Icon :name="asEvent(item).icon" :size="14" />
            </span>
            <div class="flex min-w-0 flex-1 items-center gap-3 compact:flex-col compact:items-start compact:gap-1">
              <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1 text-subheadline text-content-strong">
                <slot name="event" :item="asEvent(item)">{{ asEvent(item).text }}</slot>
              </div>
              <span class="shrink-0 text-footnote text-content-muted">{{ meta(asEvent(item).actor, item.at) }}</span>
            </div>
          </div>

          <div v-else data-test="activity-comment" :data-mine="asComment(item).mine ? 'true' : undefined" class="flex min-w-0 items-end gap-2"
            :class="asComment(item).mine ? 'justify-end' : ''">
            <Avatar v-if="!asComment(item).mine" :src="asComment(item).avatarUrl" :name="asComment(item).author" size="md" />
            <div class="flex max-w-[78%] min-w-0 flex-col gap-1" :class="asComment(item).mine ? 'items-end' : 'items-start'">
              <p class="rounded-2xl px-3.5 py-2 text-body break-words whitespace-pre-line text-content-strong"
                :class="asComment(item).mine ? 'rounded-br-md bg-surface-selected' : 'rounded-bl-md bg-surface-cell shadow-group'">{{ asComment(item).body }}</p>
              <span class="flex flex-wrap items-center gap-1.5 px-1 text-caption text-content-muted" :class="asComment(item).mine ? 'justify-end' : ''">
                {{ meta(asComment(item).author, item.at) }}
                <slot name="comment-meta" :item="asComment(item)" />
                <slot name="comment-actions" :item="asComment(item)" />
              </span>
            </div>
          </div>
        </li>
      </ol>
    </section>
  </div>
</template>
