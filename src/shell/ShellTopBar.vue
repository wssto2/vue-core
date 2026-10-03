<script setup lang="ts">
import { computed, provide } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter, type RouteLocationRaw } from "vue-router";
import { ShellOutlet } from "../app/contributions";
import { Icon } from "../icon";
import { useMediaQuery } from "../internal/mediaQuery";
import { Menu, type MenuItem } from "../overlay";
import { usePageChromeContext } from "../page";
import { usePlatform } from "../platform/platform";
import { heldSession } from "../platform/session";
import NavigationMenuButton from "./NavigationMenuButton.vue";
import ShellBrand from "./ShellBrand.vue";
import { headerSurfaceKey } from "./accountMenu";

/**
 * The top bar, only where the sidebar cannot carry the brand (UI decision D18):
 *
 * - signed out (the login page): the brand, on every width;
 * - phones, signed in: the nav bar. On a module page (no back) the round menu button that opens the
 *   navigation drawer and the `headerActions` of the shell beside it; on a record or deeper page
 *   "‹ back" to the page's parent; while editing the page's leading action (Cancel). Then the page
 *   title once its large title has scrolled under the bar (or a fixed nav title), and on the right
 *   only the page's own actions: primary ones and a "More" menu for the rest. Sticky and
 *   translucent, because an installed app has no browser back button to fall back on.
 *
 * It reads the page chrome (`usePageChrome`), so a page declares its back, actions and status once
 * and the desktop toolbar (inside `AdaptivePageShell`) shows the same. On wide screens a signed-in
 * user has no top bar: the sidebar carries the brand and the account.
 *
 *   <ShellTopBar :home="{ name: 'home' }"><template #end>…</template></ShellTopBar>
 */
defineProps<{ home?: RouteLocationRaw }>();

defineSlots<{
  /** The logo of the signed-out bar. */
  brand?: (scope: { tone: "light" | "brand" }) => unknown;
  /** Extra content at the end of the bar. */
  end?: () => unknown;
}>();

const { t } = useI18n();
const router = useRouter();
const chrome = usePageChromeContext();
const { session } = usePlatform();
const phone = useMediaQuery("(max-width: 47.999rem)");

provide(headerSurfaceKey, "bar");

const authenticated = computed(() => heldSession(session.state.value) !== null);
const shown = computed(() => !authenticated.value || phone.value);

const back = computed(() => (authenticated.value ? chrome.back.value : null));
const leading = computed(() => (authenticated.value ? chrome.leading.value : null));
const title = computed(() => chrome.navTitle.value ?? chrome.title.value);
const showTitle = computed(() => authenticated.value && !!title.value && (!!chrome.navTitle.value || !chrome.titleInView.value));

const actions = computed(() => (authenticated.value ? chrome.actions.value : []));
const primary = computed(() => actions.value.filter((action) => action.placement === "primary" && action.tone !== "critical"));
const menuItems = computed<MenuItem[]>(() =>
  actions.value
    .filter((action) => !primary.value.includes(action))
    .map((action) => ({ id: action.id, label: action.label, icon: action.icon, tone: action.tone, disabled: action.disabled, processing: action.processing, onSelect: action.onClick })),
);

function goBack() {
  if (back.value) void router.push(back.value.to);
}
</script>

<template>
  <header v-if="shown" data-shell-top-bar
    class="pt-[max(0.25rem,env(safe-area-inset-top))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-1 pl-[max(0.5rem,env(safe-area-inset-left))] text-content-strong"
    :class="authenticated
      ? ['sticky top-0 z-30 border-b bg-surface-page/85 backdrop-blur-xl transition-colors duration-motion-normal', showTitle ? 'border-border-separator' : 'border-transparent']
      : 'border-b border-border-separator bg-surface-cell'">
    <!-- Three columns so a long back label, the title and the actions truncate instead of running into each other. -->
    <div class="grid min-h-bar-height grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1">
      <div class="flex min-w-0 items-center justify-start">
        <button v-if="leading" type="button" data-shell-bar-leading :data-page-action="leading.id" :disabled="leading.disabled || leading.processing"
          class="hit-target inline-flex min-w-0 cursor-pointer items-center rounded-control px-2 text-body text-content-link disabled:text-content-disabled"
          @click="leading.onClick()">
          <span class="truncate">{{ leading.label }}</span>
        </button>
        <button v-else-if="back" type="button" data-shell-bar-back
          class="hit-target inline-flex min-w-0 cursor-pointer items-center rounded-control pr-2 text-body text-content-link active:opacity-60"
          @click="goBack">
          <Icon name="arrowLeftSLine" :size="28" class="-mr-0.5 shrink-0" />
          <!-- Once the title takes the middle, the back button shrinks to its arrow (the label would run into the title); the label stays for screen readers. -->
          <span class="truncate" :class="showTitle ? 'sr-only' : ''">{{ back.label }}</span>
        </button>
        <!-- A module page: the menu button opens the navigation drawer; beside it the shell's header actions. -->
        <template v-else-if="authenticated">
          <NavigationMenuButton />
          <span class="ml-1 flex items-center gap-1"><ShellOutlet name="headerActions" /></span>
        </template>
        <!-- Signed out (the login page): the brand. -->
        <ShellBrand v-else :to="home" tone="brand" class="px-2 transition-opacity" :class="showTitle ? 'opacity-0' : 'opacity-100'">
          <template v-if="$slots.brand" #default="scope"><slot name="brand" v-bind="scope" /></template>
        </ShellBrand>
      </div>

      <!-- The page title, once the page's own large title is under the bar. -->
      <span aria-hidden="true" data-shell-bar-title
        class="pointer-events-none truncate text-center text-headline font-semibold transition-opacity duration-motion-normal"
        :class="showTitle ? 'max-w-[42vw] opacity-100' : 'max-w-0 opacity-0'">{{ title }}</span>

      <div class="flex min-w-0 items-center justify-end">
        <template v-if="authenticated">
          <template v-for="action in primary" :key="action.id">
            <button v-if="action.compact === 'icon' && action.icon" type="button" :data-page-action="action.id" :aria-label="action.label"
              :disabled="action.disabled || action.processing"
              class="hit-target mx-1 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-tint-soft text-content-link disabled:opacity-45"
              @click="action.onClick()">
              <Icon :name="action.processing ? 'loader4Line' : action.icon" :size="18" :class="action.processing ? 'animate-spin' : ''" />
            </button>
            <button v-else type="button" :data-page-action="action.id" :disabled="action.disabled || action.processing"
              :aria-label="action.shortLabel ? action.label : undefined" :aria-busy="action.processing || undefined"
              class="hit-target flex min-w-0 shrink cursor-pointer items-center gap-1 rounded-control px-2 text-body font-semibold text-content-link disabled:text-content-disabled"
              @click="action.onClick()">
              <Icon v-if="action.processing" name="loader4Line" :size="16" class="animate-spin" />
              <span class="truncate">{{ action.shortLabel ?? action.label }}</span>
            </button>
          </template>
          <Menu v-if="menuItems.length" :items="menuItems" :label="t('core.page.more_actions')">
            <template #trigger="{ toggle, attrs }">
              <button type="button" v-bind="attrs" :aria-label="t('core.page.more_actions')" data-shell-bar-more
                class="hit-target flex size-9 cursor-pointer items-center justify-center rounded-full text-content-link" @click="toggle">
                <Icon name="moreLine" :size="22" />
              </button>
            </template>
          </Menu>
        </template>
        <slot name="end" />
      </div>
    </div>
  </header>
</template>
