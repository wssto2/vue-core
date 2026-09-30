<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Button from "../button/Button.vue";
import { Icon } from "../icon";
import Menu, { type MenuItem } from "../overlay/Menu.vue";
import type { PageAction } from "./types";

/**
 * Page actions as buttons with a "More" menu: the desktop rendering shared by the toolbar and the
 * large-title header. Primary is filled, secondary standard, `prominence: "plain"` text only;
 * overflow and critical actions go in the menu. Disabled and processing actions stay visible and
 * inert.
 */
const props = defineProps<{ actions: readonly PageAction[]; leading?: PageAction | null }>();

const { t } = useI18n();

const inline = computed(() => [
  ...(props.leading ? [props.leading] : []),
  ...props.actions.filter((action) => action.placement !== "overflow" && action.tone !== "critical"),
]);

const overflow = computed<MenuItem[]>(() => props.actions
  .filter((action) => action.placement === "overflow" || action.tone === "critical")
  .map((action) => ({
    id: action.id,
    label: action.label,
    icon: action.icon,
    tone: action.tone,
    disabled: action.disabled,
    processing: action.processing,
    onSelect: action.onClick,
  })));

function prominence(action: PageAction) {
  if (action === props.leading || action.prominence === "plain") return "plain";
  if (action.prominence === "standard") return "standard";
  return action.placement === "primary" ? "primary" : "standard";
}
</script>

<template>
  <div v-if="inline.length || overflow.length" class="flex min-w-0 flex-wrap items-center justify-end gap-2">
    <Button v-for="action in inline" :key="action.id" :prominence="prominence(action)" :icon="action.icon" :disabled="action.disabled"
      :processing="action.processing" :keyboard-shortcut="action.keyboardShortcut" :data-page-action="action.id" @click="action.onClick()">
      {{ action.label }}
    </Button>
    <Menu v-if="overflow.length" :items="overflow" :label="t('core.page.more_actions')">
      <template #trigger="{ toggle, attrs }">
        <button type="button" v-bind="attrs" :aria-label="t('core.page.more_actions')" data-page-overflow
          class="hit-target flex size-9 cursor-pointer items-center justify-center rounded-button bg-fill text-content-strong transition-colors duration-motion-fast hover:bg-fill-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          @click="toggle">
          <Icon name="moreLine" />
        </button>
      </template>
    </Menu>
  </div>
</template>
