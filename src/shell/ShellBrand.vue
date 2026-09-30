<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { RouterLink, type RouteLocationRaw } from "vue-router";
import { usePlatform } from "../platform/platform";
import { isPlainClick } from "./links";

/**
 * The application's name or logo, as a link home: the sidebar's head, the phone drawer's head and
 * the signed-out top bar. The default slot is the logo and receives the `tone` it is drawn on
 * (`light` on the dark sidebar, `brand` on the page); without one the application's name is shown.
 *
 *   <ShellBrand :to="{ name: 'home' }" tone="light"><AppLogo :tone="tone" /></ShellBrand>
 *
 * With `intercept` a plain click is reported as `select` instead of navigating (the phone drawer
 * closes once the route has resolved).
 */
const props = withDefaults(defineProps<{
  to?: RouteLocationRaw;
  tone?: "light" | "brand";
  intercept?: boolean;
}>(), { to: "/", tone: "brand", intercept: false });

const emit = defineEmits<{ select: [to: RouteLocationRaw] }>();

defineSlots<{ default?: (scope: { tone: "light" | "brand" }) => unknown }>();

defineOptions({ inheritAttrs: false });

const { t } = useI18n();
const { config } = usePlatform();

function follow(event: MouseEvent, navigate: (event: MouseEvent) => unknown) {
  if (props.intercept && isPlainClick(event)) {
    event.preventDefault();
    emit("select", props.to);
    return;
  }
  navigate(event);
}
</script>

<template>
  <RouterLink custom :to="to" v-slot="{ href, navigate }">
    <a v-bind="$attrs" :href="href" :aria-label="t('core.shell.home')" data-shell-brand
      class="inline-block rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
      @click="follow($event, navigate)">
      <slot :tone="tone">
        <span class="block truncate text-headline font-semibold" :class="tone === 'light' ? 'text-white' : 'text-content-strong'">{{ config.appName }}</span>
      </slot>
    </a>
  </RouterLink>
</template>
