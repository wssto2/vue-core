<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { Button } from "../button";
import { useFormat } from "../format";
import { Icon } from "../icon";
import type { Item } from "../modules/notification/entities";
import { AsyncSection, type AsyncState, type Hue } from "../state";
import { useNotificationsContext } from "./context";
import type { Inbox } from "./inbox";
import MarkAllRead from "./MarkAllRead.vue";
import SettingsLink from "./SettingsLink.vue";

/**
 * The inbox: what the popover (wide screens) and the sheet (phones) show. Newest first; a tap marks the
 * notification read and opens its link; "Mark all as read" marks what has been seen; older ones
 * come with "Show older". Loading, failure and emptiness are the library's own states.
 */
const props = defineProps<{ inbox: Inbox; appearance: "popover" | "sheet" }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const router = useRouter();
const format = useFormat();
const { categories, settings } = useNotificationsContext();

// Written out in full so Tailwind generates every class.
const TILES: Record<Hue, string> = {
  amber: "bg-category-amber-surface text-category-amber-content",
  lime: "bg-category-lime-surface text-category-lime-content",
  teal: "bg-category-teal-surface text-category-teal-content",
  cyan: "bg-category-cyan-surface text-category-cyan-content",
  blue: "bg-category-blue-surface text-category-blue-content",
  indigo: "bg-category-indigo-surface text-category-indigo-content",
  violet: "bg-category-violet-surface text-category-violet-content",
  fuchsia: "bg-category-fuchsia-surface text-category-fuchsia-content",
  pink: "bg-category-pink-surface text-category-pink-content",
};
const NEUTRAL_TILE = "bg-fill text-content-muted";

const state = computed<AsyncState<readonly Item[]>>(() => {
  const { list, items } = props.inbox;
  if (list.value.status === "failed") {
    const error = t("core.notifications.load_error");
    return items.value.length > 0 ? { status: "stale", value: items.value, error } : { status: "failed", error };
  }
  if (list.value.status === "loaded") return { status: "loaded", value: items.value };
  return items.value.length > 0 ? { status: "refreshing", value: items.value } : { status: "loading" };
});

const tile = (item: Item) => {
  const look = categories[item.category];
  return { icon: look?.icon ?? "notification3Line", classes: look?.hue ? TILES[look.hue] : NEUTRAL_TILE } as const;
};

// A link is a path inside the application (go-core refuses anything else); anything else is not followed.
const isPath = (link: string) => link.startsWith("/") && !link.startsWith("//");

function open(item: Item) {
  void props.inbox.markRead(item);
  if (item.link === "" || !isPath(item.link)) return;
  emit("close");
  void router.push(item.link);
}
</script>

<template>
  <div data-notification-inbox class="w-full min-w-0 sm:w-96">
    <!-- The popover carries its title and "Mark all as read" here; the sheet has the title and gear in its header and the button in its footer. -->
    <div v-if="appearance === 'popover'" class="mb-1 flex items-center justify-between gap-2">
      <h2 class="px-1 text-headline font-semibold">{{ t("core.notifications.title") }}</h2>
      <div class="flex items-center gap-1">
        <SettingsLink v-if="settings" @click="emit('close')" />
        <MarkAllRead :inbox="inbox" />
      </div>
    </div>

    <AsyncSection :state="state" :empty-title="t('core.notifications.empty_title')" :empty-description="t('core.notifications.empty_description')" empty-icon="notification3Line" @retry="inbox.load()">
      <template #default="{ value }">
        <ul class="-mx-1 max-h-[min(28rem,60dvh)] overflow-y-auto overscroll-contain">
          <li v-for="item in value" :key="item.id">
            <button type="button" data-notification-item :data-unread="item.read_at === null ? 'true' : undefined"
              class="flex w-full cursor-pointer items-start gap-3 rounded-control px-2 py-2.5 text-left transition-colors duration-motion-fast hover:bg-fill focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus"
              @click="open(item)">
              <span class="flex size-9 shrink-0 items-center justify-center rounded-full" :class="tile(item).classes" aria-hidden="true">
                <Icon :name="tile(item).icon" :size="18" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-subheadline" :class="item.read_at === null ? 'font-semibold text-content-strong' : 'font-medium text-content'">{{ item.title }}</span>
                <span v-if="item.body" class="mt-0.5 line-clamp-2 block text-footnote text-content-muted">{{ item.body }}</span>
                <time :datetime="item.created_at" class="mt-0.5 block text-footnote text-content-muted">{{ format.relative(item.created_at) }}</time>
              </span>
              <span v-if="item.read_at === null" class="mt-2 size-2 shrink-0 rounded-full bg-content-link" aria-hidden="true"></span>
              <span v-if="item.read_at === null" class="sr-only">{{ t("core.notifications.unread") }}</span>
            </button>
          </li>
        </ul>
        <div v-if="inbox.hasMore.value" class="mt-2 flex flex-col items-center gap-1" data-notification-more>
          <p v-if="inbox.more.value === 'failed'" class="text-footnote text-status-danger-content" role="alert">{{ t("core.notifications.load_more_error") }}</p>
          <Button prominence="plain" size="sm" :processing="inbox.more.value === 'loading'" @click="inbox.loadMore()">{{ t("core.notifications.load_more") }}</Button>
        </div>
      </template>
    </AsyncSection>
  </div>
</template>
