<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";
import Menu, { type MenuItem } from "../overlay/Menu.vue";
import type { RowAction } from "./columns";

/**
 * The More button of a row and the menu of its actions, for the explorer and the tree (internal). A row without actions shows nothing.
 * `label` names the row ("More actions: Kontakt"), so the buttons of a list are told apart.
 */
const props = defineProps<{ actions: readonly RowAction[]; label: string }>();

const { t } = useI18n();
const items = computed<MenuItem[]>(() => props.actions.map((action) => ({
  id: action.key,
  label: action.label,
  icon: action.icon,
  section: action.section,
  tone: action.tone === "critical" ? "critical" : undefined,
  onSelect: () => {
    if (action.onSelect) action.onSelect();
    else if (action.href) window.open(action.href, action.external ? "_blank" : "_self", action.external ? "noopener" : undefined);
  },
})));
const name = computed(() => `${t("core.page.more_actions")}: ${props.label}`);
</script>

<template>
  <Menu v-if="props.actions.length > 0" :items="items" :label="name">
    <template #trigger="{ toggle, attrs }">
      <button type="button" v-bind="attrs" :aria-label="name" data-test="row-more" @click.stop="toggle"
        class="hit-target flex size-8 cursor-pointer items-center justify-center rounded-full text-content-muted transition-colors duration-motion-fast hover:bg-fill hover:text-content-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus">
        <Icon name="moreLine" :size="18" />
      </button>
    </template>
  </Menu>
</template>
