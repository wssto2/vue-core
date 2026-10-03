<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Panel } from "../../content";
import { SwitchField } from "../../form";
import { Icon } from "../../icon";
import type { Preferences } from "../../modules/notification/entities";
import { useCategoryText } from "./categoryText";

/**
 * "E-mail me about": one switch per category the application declared, saved as it is switched. A setting someone else
 * enforces is shown locked, with who decides; without e-mail there is a sentence and no switches. In-app is not a switch: it is always on.
 */
const props = defineProps<{ preferences: Preferences; saving: readonly string[] }>();
const emit = defineEmits<{ change: [category: string, enabled: boolean] }>();

const { t } = useI18n();
const textOf = useCategoryText();
</script>

<template>
  <Panel :title="t('core.notifications.settings.email.title')" icon="notification3Line" data-notification-email>
    <p v-if="!props.preferences.email_available" class="text-subheadline text-content-muted" data-email-unavailable>{{ t("core.notifications.settings.email.unavailable") }}</p>
    <template v-else>
      <ul class="divide-y divide-border-separator">
        <li v-for="category in props.preferences.categories" :key="category.category" :data-category="category.category" class="py-1 first:pt-0 last:pb-0">
          <SwitchField :model-value="category.email.enabled" :label="textOf(category.category).label" :hint="category.email.source === 'enforced' ? t('core.notifications.settings.email.locked') : textOf(category.category).description"
            :disabled="category.email.source === 'enforced' || props.saving.includes(category.category)" @update:model-value="emit('change', category.category, $event)">
            <template v-if="category.email.source === 'enforced'" #before><Icon name="lockLine" :size="14" class="text-content-muted" /></template>
          </SwitchField>
        </li>
      </ul>
    </template>
    <p class="mt-3 text-footnote text-content-muted" data-in-app>{{ t("core.notifications.settings.email.in_app") }}</p>
  </Panel>
</template>
