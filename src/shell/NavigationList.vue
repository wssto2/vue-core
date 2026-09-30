<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { RouterLink, type RouteLocationRaw } from "vue-router";
import { Icon } from "../icon";
import { useNavigation, type NavigationItem } from "../router/navigation";
import { useKnownIcon } from "./icons";
import { groupNavigation } from "./navigationGroups";

/**
 * The server's menu for the signed-in user, as a list of links: headings over groups of two or more
 * destinations, the current destination marked (`aria-current="page"`), a destination whose feature
 * is not installed left out. Reads the application's menu (`useNavigation()`) unless `items` is given.
 *
 * - `rail`: the desktop sidebar, on the dark anchor surface.
 * - `drawer`: the phone drawer, on the page surface; a tap is reported as `select` instead of
 *   navigating, so the drawer can close once the route has resolved (a modified click still opens
 *   a new tab).
 *
 *   <NavigationList appearance="rail" />
 */
const props = withDefaults(defineProps<{
  items?: readonly NavigationItem[];
  appearance?: "rail" | "drawer";
  /** The accessible name of the list. Default: "Menu". */
  label?: string;
}>(), { items: undefined, appearance: "rail", label: undefined });

const emit = defineEmits<{ select: [to: RouteLocationRaw] }>();

const { t } = useI18n();
const fromApplication = props.items === undefined ? useNavigation() : null;
const known = useKnownIcon();
const groups = computed(() => groupNavigation(props.items ?? fromApplication?.value ?? []));

function follow(event: MouseEvent, navigate: (event: MouseEvent) => unknown, to: RouteLocationRaw) {
  const plain = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.defaultPrevented;
  if (props.appearance === "drawer" && plain) {
    event.preventDefault();
    emit("select", to);
    return;
  }
  navigate(event);
}

const ROW = "flex w-full items-center transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus";
const RAIL = {
  item: `${ROW} group gap-2.5 rounded-md px-2.5 py-1.5 text-sm`,
  active: "bg-white/10 font-medium text-white ring-1 ring-inset ring-white/5",
  inactive: "font-normal text-gray-300 hover:bg-white/5 hover:text-white",
  iconActive: "text-primary-400",
  iconInactive: "text-gray-400 group-hover:text-gray-200",
  heading: "px-2 pb-1 text-2xs font-semibold uppercase tracking-[0.08em] text-gray-400",
  separator: "mx-2 my-2.5 border-t border-white/10",
};
const DRAWER = {
  item: `${ROW} min-h-[2.875rem] cursor-pointer gap-3.5 rounded-group px-3 text-left text-body duration-motion-fast`,
  active: "bg-tint-soft font-semibold text-content-link",
  inactive: "active:bg-fill",
  iconActive: "",
  iconInactive: "",
  heading: "px-3 pt-4.5 pb-1.5 text-subheadline text-content-muted",
  separator: "mx-3 my-3 border-t border-border-separator",
};
const look = computed(() => (props.appearance === "rail" ? RAIL : DRAWER));
const iconSize = computed(() => (props.appearance === "rail" ? (16 as const) : (22 as const)));
</script>

<template>
  <nav :aria-label="label ?? t('core.shell.menu')" data-shell-navigation :data-appearance="appearance">
    <ul :class="appearance === 'rail' ? 'space-y-0.5' : ''">
      <template v-for="(group, index) in groups" :key="group.key">
        <li v-if="group.heading" role="presentation" :class="[look.heading, appearance === 'rail' ? (index > 0 ? 'pt-4' : 'pt-1') : '']">{{ group.heading }}</li>
        <li v-else-if="group.separated" role="separator" :class="look.separator"></li>
        <li v-for="destination in group.items" :key="destination.key">
          <RouterLink custom :to="destination.to" v-slot="{ href, navigate }">
            <a :href="href" :aria-current="destination.active ? 'page' : undefined" data-shell-destination
              :class="[look.item, destination.active ? look.active : look.inactive]"
              @click="follow($event, navigate, destination.to)">
              <Icon v-if="known(destination.icon)" :name="known(destination.icon)!" :size="iconSize"
                :class="destination.active ? look.iconActive : look.iconInactive" />
              <span class="min-w-0 flex-1 truncate">{{ destination.label }}</span>
            </a>
          </RouterLink>
        </li>
      </template>
    </ul>
  </nav>
</template>
